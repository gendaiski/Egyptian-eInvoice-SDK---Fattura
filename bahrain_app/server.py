"""Local-only review server. No NBR credentials or submission endpoint exists here."""
import csv
import hashlib
import hmac
import io
import json
import os
import secrets
import sqlite3
import tempfile
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import Cookie, Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .ledger import ACCOUNTS, bhd, fils, journal_lines, payment_lines, return_workpaper, signed_fils, validate_journal, vat_for

HERE = Path(__file__).parent


class Setup(BaseModel):
    company: str = Field(min_length=2, max_length=120)
    vat_number: str = Field(min_length=3, max_length=40)
    email: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=12, max_length=256)


class Login(BaseModel):
    email: str
    password: str


class Document(BaseModel):
    kind: str
    reference: str = Field(min_length=1, max_length=80)
    party: str = Field(min_length=2, max_length=160)
    tax_date: date
    net_bhd: str
    vat_treatment: str
    recoverable: bool = False


class Payment(BaseModel):
    document_id: str
    reference: str = Field(min_length=1, max_length=80)
    paid_date: date
    amount_bhd: str


class Period(BaseModel):
    start: date
    end: date


class FilingEvidence(BaseModel):
    receipt_reference: str = Field(min_length=3, max_length=120)
    filed_date: date
    payment_reference: str = Field(default="", max_length=120)


class Auditor(BaseModel):
    email: str = Field(min_length=3, max_length=120)


class JournalLineInput(BaseModel):
    account: str
    debit_bhd: str = "0"
    credit_bhd: str = "0"


class JournalInput(BaseModel):
    entry_date: date
    reference: str = Field(min_length=1, max_length=80)
    memo: str = Field(min_length=2, max_length=200)
    lines: list[JournalLineInput] = Field(min_length=2, max_length=20)


class BankLineInput(BaseModel):
    bank_date: date
    reference: str = Field(min_length=1, max_length=80)
    description: str = Field(min_length=2, max_length=200)
    amount_bhd: str


class BankMatch(BaseModel):
    payment_id: str


def now():
    return datetime.now(timezone.utc).isoformat()


def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 260_000).hex()
    return salt + ":" + digest


def check_password(password, stored):
    salt, _ = stored.split(":", 1)
    return hmac.compare_digest(hash_password(password, salt), stored)


def rows(cursor):
    return [dict(x) for x in cursor.fetchall()]


def create_app(db_path=None):
    path = Path(db_path or os.environ.get("FATTURA_BH_DATA", HERE.parent / ".data" / "bahrain.sqlite"))
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    if os.name != "nt":
        path.parent.chmod(0o700)

    @contextmanager
    def connect():
        con = sqlite3.connect(path, timeout=20)
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA foreign_keys=ON")
        con.execute("PRAGMA journal_mode=WAL")
        try:
            yield con
            con.commit()
        except Exception:
            con.rollback()
            raise
        finally:
            con.close()

    with connect() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS company(id INTEGER PRIMARY KEY CHECK(id=1), name TEXT NOT NULL, vat_number TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','auditor')), active INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), csrf TEXT NOT NULL, expires TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('sale','purchase')), reference TEXT NOT NULL, party TEXT NOT NULL,
          tax_date TEXT NOT NULL, net_fils INTEGER NOT NULL, vat_fils INTEGER NOT NULL, vat_treatment TEXT NOT NULL, recoverable INTEGER NOT NULL,
          created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, UNIQUE(kind, reference));
        CREATE TABLE IF NOT EXISTS payments(id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id), reference TEXT UNIQUE NOT NULL,
          paid_date TEXT NOT NULL, amount_fils INTEGER NOT NULL, created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS journals(id TEXT PRIMARY KEY, entry_date TEXT NOT NULL, source_kind TEXT NOT NULL, source_id TEXT NOT NULL,
          memo TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, UNIQUE(source_kind, source_id));
        CREATE TABLE IF NOT EXISTS journal_lines(journal_id TEXT NOT NULL REFERENCES journals(id), account TEXT NOT NULL, debit_fils INTEGER NOT NULL,
          credit_fils INTEGER NOT NULL, CHECK(debit_fils >= 0 AND credit_fils >= 0));
        CREATE TABLE IF NOT EXISTS vat_returns(id TEXT PRIMARY KEY, period_start TEXT NOT NULL, period_end TEXT NOT NULL, version INTEGER NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('prepared','filing_recorded')), workpaper TEXT NOT NULL, prepared_by TEXT NOT NULL REFERENCES users(id),
          prepared_at TEXT NOT NULL, receipt_reference TEXT, filed_date TEXT, payment_reference TEXT, UNIQUE(period_start,period_end,version));
        CREATE TABLE IF NOT EXISTS audit_events(id TEXT PRIMARY KEY, at TEXT NOT NULL, user_id TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS bank_lines(id TEXT PRIMARY KEY, bank_date TEXT NOT NULL, reference TEXT UNIQUE NOT NULL,
          description TEXT NOT NULL, amount_fils INTEGER NOT NULL CHECK(amount_fils != 0), payment_id TEXT UNIQUE REFERENCES payments(id),
          created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, matched_at TEXT);
        """)
        if "active" not in {row["name"] for row in db.execute("PRAGMA table_info(users)")}:
            db.execute("ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1")
    if os.name != "nt":
        path.chmod(0o600)

    app = FastAPI(title="Fattura Bahrain local review", docs_url=None, redoc_url=None)
    app.mount("/static", StaticFiles(directory=HERE / "static"), name="static")

    def audit(db, user, action, target):
        db.execute("INSERT INTO audit_events VALUES(?,?,?,?,?)", (uuid4().hex, now(), user["id"], action, target))

    def session_response(db, user, response):
        token = secrets.token_urlsafe(32)
        csrf = secrets.token_urlsafe(24)
        expiry = (datetime.now(timezone.utc) + timedelta(hours=12)).isoformat()
        db.execute("INSERT INTO sessions VALUES(?,?,?,?)", (hashlib.sha256(token.encode()).hexdigest(), user["id"], csrf, expiry))
        response.set_cookie("fattura_bh_session", token, max_age=43_200, httponly=True, samesite="strict", secure=False)
        return {"role": user["role"], "csrf": csrf}

    def actor(fattura_bh_session: str | None = Cookie(default=None)):
        if not fattura_bh_session:
            raise HTTPException(401, "Sign in to continue")
        digest = hashlib.sha256(fattura_bh_session.encode()).hexdigest()
        with connect() as db:
            row = db.execute("SELECT u.id,u.email,u.role,u.active,s.csrf,s.expires FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?", (digest,)).fetchone()
        if not row or not row["active"] or row["expires"] < now():
            raise HTTPException(401, "Session expired; sign in again")
        return dict(row)

    def owner(user=Depends(actor), x_csrf: str | None = Header(default=None)):
        if user["role"] != "owner":
            raise HTTPException(403, "Auditor access is read-only")
        if not x_csrf or not hmac.compare_digest(x_csrf, user["csrf"]):
            raise HTTPException(403, "Missing or invalid form token")
        return user

    def unlocked(db, entry_date):
        hit = db.execute("SELECT id FROM vat_returns WHERE status='filing_recorded' AND period_start<=? AND period_end>=? LIMIT 1", (str(entry_date), str(entry_date))).fetchone()
        if hit:
            raise HTTPException(409, "This VAT period has filing evidence; post an adjustment in an open period")

    def post_journal(db, user, day, source_kind, source_id, memo, lines):
        validate_journal(lines)
        journal_id = uuid4().hex
        db.execute("INSERT INTO journals VALUES(?,?,?,?,?,?,?)", (journal_id, str(day), source_kind, source_id, memo, user["id"], now()))
        db.executemany("INSERT INTO journal_lines VALUES(?,?,?,?)", [(journal_id, *line) for line in lines])

    @app.get("/", response_class=HTMLResponse)
    def home():
        return (HERE / "static" / "index.html").read_text(encoding="utf-8")

    @app.get("/api/setup-status")
    def setup_status():
        with connect() as db:
            return {"setup_required": db.execute("SELECT 1 FROM users LIMIT 1").fetchone() is None}

    @app.get("/health")
    def health():
        with connect() as db:
            db.execute("SELECT 1").fetchone()
        return {"status": "ok", "service": "fattura-bahrain", "nbr_connected": False}

    @app.post("/api/setup")
    def setup(data: Setup, response: Response):
        with connect() as db:
            if db.execute("SELECT 1 FROM users LIMIT 1").fetchone():
                raise HTTPException(409, "Initial setup is already complete")
            user = {"id": uuid4().hex, "role": "owner"}
            db.execute("INSERT INTO company VALUES(1,?,?)", (data.company.strip(), data.vat_number.strip()))
            db.execute("INSERT INTO users(id,email,password_hash,role) VALUES(?,?,?,?)", (user["id"], data.email.lower().strip(), hash_password(data.password), "owner"))
            audit(db, user, "company.setup", data.company.strip())
            return session_response(db, user, response)

    @app.post("/api/login")
    def login(data: Login, response: Response):
        with connect() as db:
            user = db.execute("SELECT * FROM users WHERE email=?", (data.email.lower().strip(),)).fetchone()
            if not user or not user["active"] or not check_password(data.password, user["password_hash"]):
                raise HTTPException(401, "Invalid email or password")
            audit(db, user, "session.login", user["id"])
            return session_response(db, user, response)

    @app.post("/api/logout")
    def logout(response: Response, user=Depends(actor), fattura_bh_session: str | None = Cookie(default=None)):
        with connect() as db:
            db.execute("DELETE FROM sessions WHERE token_hash=?", (hashlib.sha256(fattura_bh_session.encode()).hexdigest(),))
        response.delete_cookie("fattura_bh_session")
        return {"ok": True}

    @app.get("/api/state")
    def state(user=Depends(actor)):
        with connect() as db:
            company = dict(db.execute("SELECT name,vat_number FROM company WHERE id=1").fetchone())
            documents = rows(db.execute("SELECT d.*,COALESCE((SELECT SUM(amount_fils) FROM payments p WHERE p.document_id=d.id),0) paid_fils FROM documents d ORDER BY tax_date DESC,created_at DESC"))
            payments = rows(db.execute("SELECT p.*,d.reference document_reference,d.kind FROM payments p JOIN documents d ON d.id=p.document_id ORDER BY paid_date DESC,created_at DESC"))
            returns = rows(db.execute("SELECT * FROM vat_returns ORDER BY period_end DESC,version DESC"))
            audit_log = rows(db.execute("SELECT at,action,target FROM audit_events ORDER BY at DESC LIMIT 100"))
            balances = rows(db.execute("SELECT account,SUM(debit_fils) debit_fils,SUM(credit_fils) credit_fils FROM journal_lines GROUP BY account ORDER BY account"))
            bank_lines = rows(db.execute("SELECT b.*,p.reference payment_reference FROM bank_lines b LEFT JOIN payments p ON p.id=b.payment_id ORDER BY b.bank_date DESC,b.created_at DESC"))
            journals = rows(db.execute("SELECT id,entry_date,source_kind,memo FROM journals ORDER BY entry_date DESC,created_at DESC LIMIT 100"))
            auditors = rows(db.execute("SELECT id,email,active FROM users WHERE role='auditor' ORDER BY email"))
            net = {entry["account"]: entry["debit_fils"] - entry["credit_fils"] for entry in balances}
            revenue = -net.get("4000", 0)
            expenses = net.get("5000", 0) + net.get("5100", 0)
            trial_balance = [{"account": account, "name": name, "debit_fils": max(net.get(account, 0), 0),
                              "credit_fils": max(-net.get(account, 0), 0)} for account, name in ACCOUNTS.items() if account in net]
            return {"company": company, "user": {"email": user["email"], "role": user["role"]}, "csrf": user["csrf"],
                    "accounts": ACCOUNTS, "documents": documents, "payments": payments,
                    "returns": [{**r, "workpaper": json.loads(r["workpaper"])} for r in returns], "balances": trial_balance,
                    "reports": {"revenue_fils": revenue, "expense_fils": expenses, "profit_fils": revenue-expenses,
                                "trial_balance_balanced": sum(x["debit_fils"] for x in trial_balance) == sum(x["credit_fils"] for x in trial_balance),
                                "unmatched_bank_lines": sum(not x["payment_id"] for x in bank_lines)},
                    "bank_lines": bank_lines, "journals": journals, "audit": audit_log,
                    "auditors": auditors if user["role"] == "owner" else [],
                    "filing_mode": "NBR portal handoff; direct API not verified"}

    @app.post("/api/journals")
    def create_manual_journal(data: JournalInput, user=Depends(owner)):
        lines = []
        for line in data.lines:
            if line.account in {"1200", "2100"}:
                raise HTTPException(422, "VAT control accounts require a source document")
            try:
                debit = 0 if line.debit_bhd == "0" else fils(line.debit_bhd)
                credit = 0 if line.credit_bhd == "0" else fils(line.credit_bhd)
            except ValueError as error:
                raise HTTPException(422, str(error)) from error
            lines.append((line.account, debit, credit))
        try:
            validate_journal(lines)
        except ValueError as error:
            raise HTTPException(422, str(error)) from error
        with connect() as db:
            unlocked(db, data.entry_date)
            source_id = uuid4().hex
            post_journal(db, user, data.entry_date, "manual", source_id, f"{data.reference.strip()} · {data.memo.strip()}", lines)
            audit(db, user, "journal.manual_post", source_id)
        return {"id": source_id, "debit_bhd": bhd(sum(x[1] for x in lines)), "balanced": True}

    @app.post("/api/bank-lines")
    def create_bank_line(data: BankLineInput, user=Depends(owner)):
        try:
            amount = signed_fils(data.amount_bhd)
        except ValueError as error:
            raise HTTPException(422, str(error)) from error
        line_id = uuid4().hex
        with connect() as db:
            try:
                db.execute("INSERT INTO bank_lines(id,bank_date,reference,description,amount_fils,created_by,created_at) VALUES(?,?,?,?,?,?,?)",
                           (line_id, str(data.bank_date), data.reference.strip(), data.description.strip(), amount, user["id"], now()))
            except sqlite3.IntegrityError as error:
                raise HTTPException(409, "This bank reference already exists") from error
            audit(db, user, "bank.line_add", line_id)
        return {"id": line_id, "amount_bhd": bhd(amount)}

    @app.post("/api/bank-lines/{line_id}/match")
    def match_bank_line(line_id: str, data: BankMatch, user=Depends(owner)):
        with connect() as db:
            line = db.execute("SELECT * FROM bank_lines WHERE id=?", (line_id,)).fetchone()
            payment = db.execute("SELECT p.*,d.kind FROM payments p JOIN documents d ON d.id=p.document_id WHERE p.id=?", (data.payment_id,)).fetchone()
            if not line or not payment:
                raise HTTPException(404, "Bank line or payment not found")
            if line["payment_id"] or db.execute("SELECT 1 FROM bank_lines WHERE payment_id=?", (data.payment_id,)).fetchone():
                raise HTTPException(409, "This bank line or payment is already matched")
            expected = payment["amount_fils"] if payment["kind"] == "sale" else -payment["amount_fils"]
            if line["amount_fils"] != expected:
                raise HTTPException(422, "Bank amount and payment direction must match exactly")
            db.execute("UPDATE bank_lines SET payment_id=?,matched_at=? WHERE id=?", (data.payment_id, now(), line_id))
            audit(db, user, "bank.match", line_id)
        return {"matched": True}

    @app.post("/api/documents")
    def create_document(data: Document, user=Depends(owner)):
        if data.kind not in ("sale", "purchase"):
            raise HTTPException(422, "Choose sale or purchase")
        try:
            net = fils(data.net_bhd)
            vat = vat_for(net, data.vat_treatment)
        except ValueError as error:
            raise HTTPException(422, str(error)) from error
        if data.recoverable and (data.kind != "purchase" or data.vat_treatment != "standard"):
            raise HTTPException(422, "Recoverable VAT applies only to standard-rated purchases")
        doc_id = uuid4().hex
        with connect() as db:
            unlocked(db, data.tax_date)
            try:
                db.execute("INSERT INTO documents VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                           (doc_id, data.kind, data.reference.strip(), data.party.strip(), str(data.tax_date), net, vat,
                            data.vat_treatment, int(data.recoverable), user["id"], now()))
            except sqlite3.IntegrityError as error:
                raise HTTPException(409, "This document reference already exists") from error
            post_journal(db, user, data.tax_date, "document", doc_id, data.reference.strip(), journal_lines(data.kind, net, vat, data.recoverable))
            audit(db, user, "document.post", doc_id)
        return {"id": doc_id, "net_bhd": bhd(net), "vat_bhd": bhd(vat), "gross_bhd": bhd(net + vat)}

    @app.post("/api/payments")
    def create_payment(data: Payment, user=Depends(owner)):
        try:
            amount = fils(data.amount_bhd)
        except ValueError as error:
            raise HTTPException(422, str(error)) from error
        payment_id = uuid4().hex
        with connect() as db:
            unlocked(db, data.paid_date)
            doc = db.execute("SELECT * FROM documents WHERE id=?", (data.document_id,)).fetchone()
            if not doc:
                raise HTTPException(404, "Document not found")
            paid = db.execute("SELECT COALESCE(SUM(amount_fils),0) FROM payments WHERE document_id=?", (data.document_id,)).fetchone()[0]
            if amount > doc["net_fils"] + doc["vat_fils"] - paid:
                raise HTTPException(422, "Payment exceeds the outstanding document balance")
            try:
                db.execute("INSERT INTO payments VALUES(?,?,?,?,?,?,?)",
                           (payment_id, data.document_id, data.reference.strip(), str(data.paid_date), amount, user["id"], now()))
            except sqlite3.IntegrityError as error:
                raise HTTPException(409, "This payment reference already exists") from error
            post_journal(db, user, data.paid_date, "payment", payment_id, data.reference.strip(), payment_lines(doc["kind"], amount))
            audit(db, user, "payment.post", payment_id)
        return {"id": payment_id, "amount_bhd": bhd(amount)}

    @app.post("/api/returns/prepare")
    def prepare_return(period: Period, user=Depends(owner)):
        if period.start > period.end or (period.end - period.start).days > 366:
            raise HTTPException(422, "Choose a valid VAT period of at most one year")
        with connect() as db:
            overlap = db.execute("SELECT 1 FROM vat_returns WHERE status='filing_recorded' AND period_start<=? AND period_end>=?", (str(period.end), str(period.start))).fetchone()
            if overlap:
                raise HTTPException(409, "A filed period overlaps this workpaper")
            documents = rows(db.execute("SELECT kind,vat_treatment,net_fils,vat_fils,recoverable FROM documents WHERE tax_date BETWEEN ? AND ?", (str(period.start), str(period.end))))
            summary = return_workpaper(documents)
            version = db.execute("SELECT COALESCE(MAX(version),0)+1 FROM vat_returns WHERE period_start=? AND period_end=?", (str(period.start), str(period.end))).fetchone()[0]
            return_id = uuid4().hex
            db.execute("INSERT INTO vat_returns(id,period_start,period_end,version,status,workpaper,prepared_by,prepared_at) VALUES(?,?,?,?,'prepared',?,?,?)",
                       (return_id, str(period.start), str(period.end), version, json.dumps(summary), user["id"], now()))
            audit(db, user, "return.prepare", return_id)
        return {"id": return_id, "version": version, "status": "prepared", "workpaper": summary}

    @app.post("/api/returns/{return_id}/record-filing")
    def record_filing(return_id: str, evidence: FilingEvidence, user=Depends(owner)):
        with connect() as db:
            entry = db.execute("SELECT * FROM vat_returns WHERE id=?", (return_id,)).fetchone()
            if not entry:
                raise HTTPException(404, "Workpaper not found")
            if entry["status"] != "prepared":
                raise HTTPException(409, "Filing was already recorded")
            newer = db.execute("SELECT 1 FROM vat_returns WHERE period_start=? AND period_end=? AND version>?", (entry["period_start"], entry["period_end"], entry["version"])).fetchone()
            if newer:
                raise HTTPException(409, "Record filing against the latest workpaper version")
            changed = db.execute("SELECT 1 FROM documents WHERE tax_date BETWEEN ? AND ? AND created_at>? LIMIT 1", (entry["period_start"], entry["period_end"], entry["prepared_at"])).fetchone()
            if changed:
                raise HTTPException(409, "Documents changed after preparation; prepare and review a new workpaper")
            if evidence.filed_date < date.fromisoformat(entry["period_end"]):
                raise HTTPException(422, "The recorded filing date cannot precede the period end")
            db.execute("UPDATE vat_returns SET status='filing_recorded',receipt_reference=?,filed_date=?,payment_reference=? WHERE id=?",
                       (evidence.receipt_reference.strip(), str(evidence.filed_date), evidence.payment_reference.strip(), return_id))
            audit(db, user, "filing.receipt_recorded", return_id)
        return {"status": "filing_recorded", "receipt_reference": evidence.receipt_reference.strip(),
                "note": "Receipt supplied by user; NBR status has not been independently queried"}

    @app.post("/api/auditors")
    def add_auditor(data: Auditor, user=Depends(owner)):
        password = secrets.token_urlsafe(18)
        auditor_id = uuid4().hex
        with connect() as db:
            try:
                db.execute("INSERT INTO users(id,email,password_hash,role) VALUES(?,?,?,?)", (auditor_id, data.email.lower().strip(), hash_password(password), "auditor"))
            except sqlite3.IntegrityError as error:
                raise HTTPException(409, "This email already has access") from error
            audit(db, user, "auditor.add", auditor_id)
        return {"email": data.email.lower().strip(), "one_time_password": password,
                "note": "Share this once through a secure channel; the app does not send invitations"}

    @app.post("/api/auditors/{auditor_id}/revoke")
    def revoke_auditor(auditor_id: str, user=Depends(owner)):
        with connect() as db:
            result = db.execute("UPDATE users SET active=0 WHERE id=? AND role='auditor' AND active=1", (auditor_id,))
            if not result.rowcount:
                raise HTTPException(404, "Active auditor not found")
            db.execute("DELETE FROM sessions WHERE user_id=?", (auditor_id,))
            audit(db, user, "auditor.revoke", auditor_id)
        return {"ok": True}

    @app.get("/api/exports/{kind}.csv")
    def export_csv(kind: str, user=Depends(actor)):
        with connect() as db:
            if kind == "general-ledger":
                data = rows(db.execute("SELECT j.entry_date,j.source_kind,j.memo,l.account,l.debit_fils,l.credit_fils FROM journals j JOIN journal_lines l ON l.journal_id=j.id ORDER BY j.entry_date,j.created_at,l.rowid"))
            elif kind == "payments":
                data = rows(db.execute("SELECT p.paid_date,p.reference,d.reference document_reference,d.kind,p.amount_fils FROM payments p JOIN documents d ON d.id=p.document_id ORDER BY p.paid_date,p.created_at"))
            elif kind == "vat-workpapers":
                data = rows(db.execute("SELECT period_start,period_end,version,status,workpaper,receipt_reference,filed_date,payment_reference FROM vat_returns ORDER BY period_end,version"))
            elif kind == "audit-events":
                data = rows(db.execute("SELECT at,user_id,action,target FROM audit_events ORDER BY at DESC"))
            elif kind == "bank-lines":
                data = rows(db.execute("SELECT bank_date,reference,description,amount_fils,payment_id,matched_at FROM bank_lines ORDER BY bank_date,created_at"))
            else:
                raise HTTPException(404, "Unknown export")
        output = io.StringIO()
        columns = list(data[0]) if data else {"general-ledger": ["entry_date", "source_kind", "memo", "account", "debit_fils", "credit_fils"],
                                          "payments": ["paid_date", "reference", "document_reference", "kind", "amount_fils"],
                                          "vat-workpapers": ["period_start", "period_end", "version", "status", "workpaper", "receipt_reference", "filed_date", "payment_reference"],
                                          "audit-events": ["at", "user_id", "action", "target"],
                                          "bank-lines": ["bank_date", "reference", "description", "amount_fils", "payment_id", "matched_at"]}[kind]
        writer = csv.DictWriter(output, fieldnames=columns)
        writer.writeheader()
        writer.writerows({key: "'" + value if isinstance(value, str) and value.startswith(("=", "+", "-", "@")) else value
                          for key, value in row.items()} for row in data)
        return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="fattura-bahrain-{kind}.csv"'})

    @app.get("/api/backup.sqlite")
    def backup(user=Depends(actor)):
        if user["role"] != "owner":
            raise HTTPException(403, "Only the owner can download a full database backup")
        with tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False) as temporary:
            backup_path = Path(temporary.name)
        try:
            with connect() as db, sqlite3.connect(backup_path) as target:
                db.backup(target)
            content = backup_path.read_bytes()
        finally:
            backup_path.unlink(missing_ok=True)
        return StreamingResponse(iter([content]), media_type="application/octet-stream",
                                 headers={"Content-Disposition": 'attachment; filename="fattura-bahrain-backup.sqlite"',
                                          "Cache-Control": "no-store"})

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("FATTURA_BH_PORT", "8797")))
