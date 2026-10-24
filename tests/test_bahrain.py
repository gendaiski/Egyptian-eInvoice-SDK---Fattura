import tempfile
import sqlite3
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from bahrain_app.ledger import bhd, fils, journal_lines, return_workpaper, signed_fils, vat_for
from bahrain_app.server import create_app


class LedgerTests(unittest.TestCase):
    def test_bhd_precision_and_balanced_entries(self):
        self.assertEqual(fils("10.005"), 10005)
        self.assertEqual(bhd(10005), "10.005")
        self.assertEqual(vat_for(10005, "standard"), 1001)
        self.assertEqual(signed_fils("-5.250"), -5250)
        with self.assertRaises(ValueError):
            fils("1.0001")
        for kind in ("sale", "purchase"):
            lines = journal_lines(kind, 10005, 1001, kind == "purchase")
            self.assertEqual(sum(x[1] for x in lines), sum(x[2] for x in lines))

    def test_vat_workpaper_separates_output_and_recoverable_input(self):
        summary = return_workpaper([
            dict(kind="sale", vat_treatment="standard", net_fils=100000, vat_fils=10000, recoverable=0),
            dict(kind="sale", vat_treatment="zero", net_fils=20000, vat_fils=0, recoverable=0),
            dict(kind="purchase", vat_treatment="standard", net_fils=40000, vat_fils=4000, recoverable=1),
            dict(kind="purchase", vat_treatment="standard", net_fils=5000, vat_fils=500, recoverable=0),
        ])
        self.assertEqual(summary["standard_sales_vat"], 10000)
        self.assertEqual(summary["zero_sales_net"], 20000)
        self.assertEqual(summary["recoverable_input_vat"], 4000)
        self.assertEqual(summary["blocked_input_vat"], 500)
        self.assertEqual(summary["net_vat_due"], 6000)


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "test.sqlite"
        self.client = TestClient(create_app(self.db))
        setup = self.client.post("/api/setup", json={"company": "Bahrain Review Co", "vat_number": "BH123456", "email": "owner@example.test", "password": "strong-local-password-123"})
        self.assertEqual(setup.status_code, 200, setup.text)
        self.csrf = setup.json()["csrf"]

    def tearDown(self):
        self.client.close()
        self.tmp.cleanup()

    def post(self, path, data, client=None, csrf=None):
        return (client or self.client).post("/api/" + path, json=data, headers={"X-CSRF": csrf or self.csrf})

    def test_documents_payment_workpaper_receipt_and_restart(self):
        self.assertEqual(self.client.get("/api/state").json()["documents"], [])
        sale = self.post("documents", {"kind": "sale", "reference": "S-1", "party": "Customer", "tax_date": "2026-10-05", "net_bhd": "10.005", "vat_treatment": "standard"})
        self.assertEqual(sale.status_code, 200, sale.text)
        self.assertEqual(sale.json()["gross_bhd"], "11.006")
        purchase = self.post("documents", {"kind": "purchase", "reference": "P-1", "party": "Supplier", "tax_date": "2026-10-08", "net_bhd": "5.000", "vat_treatment": "standard", "recoverable": True})
        self.assertEqual(purchase.status_code, 200, purchase.text)
        payment = self.post("payments", {"document_id": sale.json()["id"], "reference": "BANK-1", "paid_date": "2026-10-12", "amount_bhd": "3.000"})
        self.assertEqual(payment.status_code, 200, payment.text)
        self.assertEqual(self.post("payments", {"document_id": sale.json()["id"], "reference": "BANK-2", "paid_date": "2026-10-13", "amount_bhd": "9.000"}).status_code, 422)
        state = self.client.get("/api/state").json()
        self.assertEqual(state["documents"][0]["paid_fils"] + state["documents"][1]["paid_fils"], 3000)
        self.assertEqual(sum(x["debit_fils"] for x in state["balances"]), sum(x["credit_fils"] for x in state["balances"]))
        prepared = self.post("returns/prepare", {"start": "2026-10-01", "end": "2026-10-31"})
        self.assertEqual(prepared.status_code, 200, prepared.text)
        self.assertEqual(prepared.json()["status"], "prepared")
        self.assertEqual(prepared.json()["workpaper"]["net_vat_due"], 501)
        filing = self.post(f"returns/{prepared.json()['id']}/record-filing", {"receipt_reference": "NBR-RECEIPT-001", "filed_date": "2026-11-01", "payment_reference": "BANK-VAT-1"})
        self.assertEqual(filing.status_code, 200, filing.text)
        self.assertIn("not been independently queried", filing.json()["note"])
        self.assertEqual(self.post("documents", {"kind": "sale", "reference": "S-2", "party": "Customer", "tax_date": "2026-10-20", "net_bhd": "1.000", "vat_treatment": "standard"}).status_code, 409)
        csv = self.client.get("/api/exports/general-ledger.csv")
        self.assertEqual(csv.status_code, 200)
        self.assertIn("S-1", csv.text)
        restarted = TestClient(create_app(self.db))
        login = restarted.post("/api/login", json={"email": "owner@example.test", "password": "strong-local-password-123"})
        self.assertEqual(login.status_code, 200)
        self.assertEqual(restarted.get("/api/state").json()["returns"][0]["status"], "filing_recorded")
        restarted.close()

    def test_auditor_cannot_post_or_record_filing(self):
        created = self.post("auditors", {"email": "auditor@example.test"})
        self.assertEqual(created.status_code, 200)
        auditor = TestClient(create_app(self.db))
        login = auditor.post("/api/login", json={"email": "auditor@example.test", "password": created.json()["one_time_password"]})
        self.assertEqual(login.status_code, 200)
        self.assertEqual(auditor.get("/api/state").json()["user"]["role"], "auditor")
        blocked = self.post("documents", {"kind": "sale", "reference": "BAD", "party": "Customer", "tax_date": "2026-10-05", "net_bhd": "1.000", "vat_treatment": "standard"}, client=auditor, csrf=login.json()["csrf"])
        self.assertEqual(blocked.status_code, 403)
        self.assertEqual(auditor.get("/api/exports/payments.csv").status_code, 200)
        self.assertEqual(auditor.get("/api/backup.sqlite").status_code, 403)
        auditor_id = self.client.get("/api/state").json()["auditors"][0]["id"]
        self.assertEqual(self.post(f"auditors/{auditor_id}/revoke", {}).status_code, 200)
        self.assertEqual(auditor.get("/api/state").status_code, 401)
        self.assertEqual(auditor.post("/api/login", json={"email": "auditor@example.test", "password": created.json()["one_time_password"]}).status_code, 401)
        auditor.close()

    def test_new_documents_invalidate_prepared_workpaper(self):
        first = self.post("returns/prepare", {"start": "2026-10-01", "end": "2026-10-31"}).json()
        self.assertEqual(self.post("documents", {"kind": "sale", "reference": "LATE", "party": "Customer", "tax_date": "2026-10-10", "net_bhd": "1.000", "vat_treatment": "standard"}).status_code, 200)
        evidence = {"receipt_reference": "NBR-RECEIPT-002", "filed_date": "2026-11-01"}
        self.assertEqual(self.post(f"returns/{first['id']}/record-filing", evidence).status_code, 409)
        second = self.post("returns/prepare", {"start": "2026-10-01", "end": "2026-10-31"}).json()
        self.assertEqual(second["version"], 2)
        self.assertEqual(self.post(f"returns/{second['id']}/record-filing", evidence).status_code, 200)

    def test_auth_and_duplicate_protection(self):
        stranger = TestClient(create_app(self.db))
        self.assertEqual(stranger.get("/api/state").status_code, 401)
        self.assertEqual(self.post("documents", {"kind": "sale", "reference": "S-1", "party": "Customer", "tax_date": "2026-10-05", "net_bhd": "1.000", "vat_treatment": "standard"}, csrf="wrong").status_code, 403)
        data = {"kind": "sale", "reference": "S-1", "party": "Customer", "tax_date": "2026-10-05", "net_bhd": "1.000", "vat_treatment": "standard"}
        self.assertEqual(self.post("documents", data).status_code, 200)
        self.assertEqual(self.post("documents", data).status_code, 409)
        stranger.close()

    def test_manual_journal_balances_and_protects_vat_control(self):
        data = {"entry_date": "2026-10-10", "reference": "OPEN-1", "memo": "Opening capital",
                "lines": [{"account": "1000", "debit_bhd": "100.000"},
                          {"account": "3000", "credit_bhd": "100.000"}]}
        posted = self.post("journals", data)
        self.assertEqual(posted.status_code, 200, posted.text)
        state = self.client.get("/api/state").json()
        self.assertTrue(state["reports"]["trial_balance_balanced"])
        self.assertEqual(sum(x["debit_fils"] for x in state["balances"]), 100000)
        data["lines"][1]["credit_bhd"] = "99.000"
        self.assertEqual(self.post("journals", data).status_code, 422)
        data["lines"][1] = {"account": "2100", "credit_bhd": "100.000"}
        self.assertEqual(self.post("journals", data).status_code, 422)
        self.assertEqual(self.client.get("/api/exports/audit-events.csv").status_code, 200)
        backup = self.client.get("/api/backup.sqlite")
        self.assertEqual(backup.status_code, 200)
        self.assertTrue(backup.content.startswith(b"SQLite format 3"))
        with tempfile.NamedTemporaryFile(suffix=".sqlite") as saved:
            saved.write(backup.content)
            saved.flush()
            with sqlite3.connect(saved.name) as copied:
                self.assertEqual(copied.execute("PRAGMA integrity_check").fetchone()[0], "ok")

    def test_bank_line_matches_only_one_payment_of_same_amount_and_direction(self):
        sale = self.post("documents", {"kind": "sale", "reference": "S-BANK", "party": "Customer", "tax_date": "2026-10-05", "net_bhd": "10.000", "vat_treatment": "standard"}).json()
        payment = self.post("payments", {"document_id": sale["id"], "reference": "PAY-BANK", "paid_date": "2026-10-06", "amount_bhd": "5.000"}).json()
        bad = self.post("bank-lines", {"bank_date": "2026-10-06", "reference": "BAD-DIR", "description": "Wrong direction", "amount_bhd": "-5.000"}).json()
        self.assertEqual(self.post(f"bank-lines/{bad['id']}/match", {"payment_id": payment["id"]}).status_code, 422)
        good = self.post("bank-lines", {"bank_date": "2026-10-06", "reference": "BANK-LINE", "description": "Customer transfer", "amount_bhd": "5.000"}).json()
        self.assertEqual(self.post(f"bank-lines/{good['id']}/match", {"payment_id": payment["id"]}).status_code, 200)
        self.assertEqual(self.post(f"bank-lines/{good['id']}/match", {"payment_id": payment["id"]}).status_code, 409)
        self.assertEqual(self.client.get("/api/state").json()["reports"]["unmatched_bank_lines"], 1)
        self.assertIn("BANK-LINE", self.client.get("/api/exports/bank-lines.csv").text)


if __name__ == "__main__":
    unittest.main()
