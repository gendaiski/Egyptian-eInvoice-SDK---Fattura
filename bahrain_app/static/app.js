const $ = (selector) => document.querySelector(selector);
let state = null;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const amount = (fils) => (Number(fils || 0) / 1000).toFixed(3);
const toast = (message) => { const el = $('#message'); el.textContent = message; el.classList.remove('hidden'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.add('hidden'), 5500); };
const formJson = (form) => Object.fromEntries(new FormData(form));

async function api(path, method = 'GET', data) {
  const response = await fetch('/api/' + path, { method, credentials: 'same-origin', headers: {
    ...(data ? { 'Content-Type': 'application/json' } : {}),
    ...(state?.csrf ? { 'X-CSRF': state.csrf } : {}),
  }, body: data ? JSON.stringify(data) : undefined });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(typeof json.detail === 'string' ? json.detail : `Request failed (${response.status})`);
  return json;
}

function showView(name) {
  document.querySelectorAll('.view').forEach((el) => el.classList.toggle('hidden', el.id !== name));
  document.querySelectorAll('.nav').forEach((el) => el.classList.toggle('active', el.dataset.view === name));
}
document.querySelectorAll('.nav').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
const preferredTheme = localStorage.getItem('fattura-bahrain-theme') || 'light';
document.documentElement.dataset.theme = preferredTheme;
$('#theme').onclick = () => { const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = next; localStorage.setItem('fattura-bahrain-theme', next); };

function render() {
  $('#auth').classList.add('hidden'); $('#workspace').classList.remove('hidden'); $('#logout').classList.remove('hidden');
  document.querySelectorAll('.owner-only').forEach((el) => el.classList.toggle('hidden', state.user.role !== 'owner'));
  $('#company-name').textContent = state.company.name;
  $('#company-line').textContent = `VAT registration ${state.company.vat_number} · ${state.user.role === 'auditor' ? 'Auditor (read-only)' : 'Owner'} · BHD`;
  $('#metric-sales').textContent = state.documents.filter((x) => x.kind === 'sale').length;
  $('#metric-purchases').textContent = state.documents.filter((x) => x.kind === 'purchase').length;
  $('#metric-payments').textContent = state.payments.length;
  $('#metric-returns').textContent = state.returns.length;
  $('#metric-revenue').textContent = amount(state.reports.revenue_fils);
  $('#metric-expenses').textContent = amount(state.reports.expense_fils);
  $('#metric-profit').textContent = amount(state.reports.profit_fils);
  $('#metric-unmatched').textContent = state.reports.unmatched_bank_lines;
  $('#activity-list').innerHTML = state.audit.length ? state.audit.slice(0, 8).map((x) => `<p><strong>${escapeHtml(x.action)}</strong> · ${escapeHtml(x.at.slice(0, 16).replace('T', ' '))}</p>`).join('') : 'No activity yet.';

  $('#document-rows').innerHTML = state.documents.map((d) => `<tr><td>${escapeHtml(d.tax_date)}</td><td>${escapeHtml(d.kind)}</td><td>${escapeHtml(d.reference)}</td><td>${escapeHtml(d.party)}</td><td>${escapeHtml(d.vat_treatment)}${d.recoverable ? ' · recoverable' : ''}</td><td>${amount(d.net_fils)}</td><td>${amount(d.vat_fils)}</td><td>${amount(d.net_fils + d.vat_fils - d.paid_fils)}</td></tr>`).join('') || '<tr><td colspan="8">No documents posted.</td></tr>';
  $('#payment-document').innerHTML = state.documents.filter((d) => d.net_fils + d.vat_fils > d.paid_fils).map((d) => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.reference)} · ${escapeHtml(d.kind)} · ${amount(d.net_fils + d.vat_fils - d.paid_fils)} BHD outstanding</option>`).join('');
  $('#payment-rows').innerHTML = state.payments.map((p) => `<tr><td>${escapeHtml(p.paid_date)}</td><td>${p.kind === 'sale' ? 'Customer receipt' : 'Supplier payment'}</td><td>${escapeHtml(p.reference)}</td><td>${escapeHtml(p.document_reference)}</td><td>${amount(p.amount_fils)}</td></tr>`).join('') || '<tr><td colspan="5">No payments recorded.</td></tr>';
  const matched = new Set(state.bank_lines.filter((b) => b.payment_id).map((b) => b.payment_id));
  $('#bank-rows').innerHTML = state.bank_lines.map((b) => `<tr><td>${escapeHtml(b.bank_date)}</td><td>${escapeHtml(b.reference)}</td><td>${escapeHtml(b.description)}</td><td>${amount(b.amount_fils)}</td><td>${b.payment_id ? 'Matched to ' + escapeHtml(b.payment_reference) : state.user.role === 'owner' ? `<div class="match-cell"><select aria-label="Payment to match" data-line="${escapeHtml(b.id)}"><option value="">Choose payment</option>${state.payments.filter((p) => !matched.has(p.id) && (p.kind === 'sale' ? p.amount_fils : -p.amount_fils) === b.amount_fils).map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.reference)}</option>`).join('')}</select><button class="outline match-bank" type="button" data-id="${escapeHtml(b.id)}">Match</button></div>` : 'Unmatched'}</td></tr>`).join('') || '<tr><td colspan="5">No statement lines entered.</td></tr>';
  $('#balance-rows').innerHTML = state.balances.map((b) => `<tr><td>${escapeHtml(b.account)} · ${escapeHtml(state.accounts[b.account] || '')}</td><td>${amount(b.debit_fils)}</td><td>${amount(b.credit_fils)}</td><td>${amount(b.debit_fils - b.credit_fils)}</td></tr>`).join('') || '<tr><td colspan="4">No journal entries.</td></tr>';
  $('#journal-list').innerHTML = state.journals.map((j) => `<p><strong>${escapeHtml(j.entry_date)}</strong> · ${escapeHtml(j.memo)} <span class="muted">(${escapeHtml(j.source_kind)})</span></p>`).join('') || '<p>No journal entries yet.</p>';
  $('#audit-list').innerHTML = state.audit.map((x) => `<p><strong>${escapeHtml(x.action)}</strong> · ${escapeHtml(x.at.slice(0, 16).replace('T', ' '))} · ${escapeHtml(x.target)}</p>`).join('') || '<p>No events yet.</p>';
  document.querySelectorAll('.line-account').forEach((select) => { const previous = select.value; select.innerHTML = Object.entries(state.accounts).filter(([code]) => !['1200', '2100'].includes(code)).map(([code, name]) => `<option value="${escapeHtml(code)}">${escapeHtml(code)} · ${escapeHtml(name)}</option>`).join(''); if (previous) select.value = previous; });
  $('#return-list').innerHTML = state.returns.map((r) => `<article class="card return-card"><div class="return-head"><div><strong>${escapeHtml(r.period_start)} → ${escapeHtml(r.period_end)} · version ${r.version}</strong><div class="muted">${r.status === 'filing_recorded' ? 'Filing recorded · receipt ' + escapeHtml(r.receipt_reference) : 'Prepared for review · not filed'}</div></div><span class="pill">${escapeHtml(r.status)}</span></div><div class="return-grid"><p>Standard sales<strong>${amount(r.workpaper.standard_sales_net)} BHD</strong></p><p>Output VAT<strong>${amount(r.workpaper.standard_sales_vat)} BHD</strong></p><p>Recoverable input VAT<strong>${amount(r.workpaper.recoverable_input_vat)} BHD</strong></p><p>Net VAT workpaper<strong>${amount(r.workpaper.net_vat_due)} BHD</strong></p></div>${r.status === 'prepared' && state.user.role === 'owner' ? `<form class="filing-form form-grid" data-id="${escapeHtml(r.id)}"><label>NBR receipt reference<input name="receipt_reference" required minlength="3"></label><label>Date submitted on NBR<input name="filed_date" type="date" required></label><label>Payment reference (if paid)<input name="payment_reference"></label><button class="primary" type="submit">Record official receipt</button></form>` : ''}</article>`).join('') || '<p class="card muted">No VAT workpaper yet. Post source documents, then prepare a period.</p>';
  $('#auditor-list').innerHTML = state.auditors?.length ? state.auditors.map((a) => `<p>${escapeHtml(a.email)} · ${a.active ? 'Active' : 'Revoked'} ${a.active ? `<button class="outline revoke-auditor" type="button" data-id="${escapeHtml(a.id)}">Revoke access</button>` : ''}</p>`).join('') : 'No auditor accounts.';
  document.querySelectorAll('.filing-form input[type=date]').forEach((el) => { el.value = new Date().toISOString().slice(0, 10); });
}

async function refresh() { state = await api('state'); render(); }
async function initialize() {
  try { await refresh(); }
  catch { const result = await api('setup-status'); $('#auth').classList.remove('hidden'); $('#workspace').classList.add('hidden'); $('#logout').classList.add('hidden');
    $('#setup-form').classList.toggle('hidden', !result.setup_required); $('#login-form').classList.toggle('hidden', result.setup_required);
    $('#auth-title').textContent = result.setup_required ? 'Create your Bahrain workspace' : 'Sign in to Fattura Bahrain'; }
}
function onForm(id, callback) { $(id).addEventListener('submit', async (event) => { event.preventDefault(); try { await callback(event.target); } catch (error) { toast(error.message); } }); }
onForm('#setup-form', async (form) => { await api('setup', 'POST', formJson(form)); form.reset(); await refresh(); });
onForm('#login-form', async (form) => { await api('login', 'POST', formJson(form)); form.reset(); await refresh(); });
onForm('#document-form', async (form) => { const data = formJson(form); data.recoverable = form.elements.recoverable.checked; await api('documents', 'POST', data); form.reset(); setDates(); await refresh(); toast('Document posted with a balanced journal.'); });
onForm('#payment-form', async (form) => { await api('payments', 'POST', formJson(form)); form.reset(); setDates(); await refresh(); toast('Payment recorded in the ledger.'); });
onForm('#bank-form', async (form) => { await api('bank-lines', 'POST', formJson(form)); form.reset(); setDates(); await refresh(); toast('Statement line saved. Match it to a recorded payment.'); });
onForm('#journal-form', async (form) => { const lines = [...form.querySelectorAll('.journal-line')].map((row) => ({ account: row.querySelector('.line-account').value, debit_bhd: row.querySelector('.line-debit').value || '0', credit_bhd: row.querySelector('.line-credit').value || '0' })); const data = {...formJson(form), lines}; await api('journals', 'POST', data); form.reset(); setDates(); await refresh(); toast('Balanced manual journal posted.'); });
$('#add-journal-line').onclick = () => { const row = document.querySelector('.journal-line').cloneNode(true); row.querySelectorAll('input').forEach((input) => input.value = '0'); $('#journal-form .journal-lines').append(row); };
onForm('#period-form', async (form) => { await api('returns/prepare', 'POST', formJson(form)); await refresh(); toast('VAT workpaper prepared. It has not been filed with NBR.'); });
onForm('#auditor-form', async (form) => { const result = await api('auditors', 'POST', formJson(form)); $('#auditor-result').textContent = `Auditor ${result.email} password (shown once): ${result.one_time_password}`; form.reset(); await refresh(); });
document.addEventListener('submit', async (event) => { if (!event.target.matches('.filing-form')) return; event.preventDefault(); try { await api(`returns/${event.target.dataset.id}/record-filing`, 'POST', formJson(event.target)); await refresh(); toast('Filing receipt recorded. Fattura has not queried NBR to verify it.'); } catch (error) { toast(error.message); } });
document.addEventListener('click', async (event) => { const button = event.target.closest('.revoke-auditor'); if (!button) return; if (!confirm('Revoke this auditor and end their active sessions?')) return; try { await api(`auditors/${button.dataset.id}/revoke`, 'POST'); await refresh(); toast('Auditor access revoked.'); } catch (error) { toast(error.message); } });
document.addEventListener('click', async (event) => { const button = event.target.closest('.match-bank'); if (!button) return; const select = button.parentElement.querySelector('select'); if (!select.value) return toast('Choose a payment with the same amount and direction.'); try { await api(`bank-lines/${button.dataset.id}/match`, 'POST', {payment_id: select.value}); await refresh(); toast('Statement line matched to the payment.'); } catch (error) { toast(error.message); } });
$('#logout').onclick = async () => { try { await api('logout', 'POST'); } catch {} state = null; await initialize(); };
function setDates() { document.querySelectorAll('#document-form input[type=date], #payment-form input[type=date], #bank-form input[type=date], #journal-form input[type=date]').forEach((el) => { el.value = new Date().toISOString().slice(0, 10); }); }
setDates(); initialize().catch((e) => toast(e.message));
