const $ = (selector, root = document) => root.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const bytes = (count) => count < 1024 ? `${count} B` : count < 1048576 ? `${Math.ceil(count / 1024)} KB` : `${(count / 1048576).toFixed(1)} MB`;
const stamp = (value) => value ? new Date(value).toLocaleString() : '—';
const state = { user: null, setupRequired: false, deals: [], deal: null, files: [], findings: [], activity: [], teamActivity: [], users: [], grants: [], view: 'dashboard', tab: 'overview', filter: '' };
const themes = ['dark', 'light'];
const savedTheme = localStorage.getItem('ma-theme');
if (themes.includes(savedTheme)) document.documentElement.dataset.theme = savedTheme;

async function request(path, method = 'GET', data) {
  const response = await fetch(`/api${path}`, { method, credentials: 'same-origin', headers: data ? { 'Content-Type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error?.message || `Request failed (${response.status}).`);
  }
  return response.json();
}
function toast(message) {
  const target = $('#toast');
  target.textContent = message; target.classList.remove('hidden');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => target.classList.add('hidden'), 4500);
}
function onError(error) { toast(error.message || String(error)); console.error(error); }

async function refresh() {
  const bootstrap = await request('/bootstrap');
  state.user = bootstrap.user;
  state.setupRequired = bootstrap.setupRequired;
  $('#auth').classList.toggle('hidden', !!state.user);
  $('#workspace').classList.toggle('hidden', !state.user);
  if (!state.user) {
    $('#auth-title').textContent = state.setupRequired ? 'Create your private workspace' : 'Sign in';
    $('#auth-subtitle').textContent = state.setupRequired ? 'Set the first owner account. Files and access stay in this independent system.' : 'Enter your team credentials to continue.';
    $('#auth-submit').textContent = state.setupRequired ? 'Create workspace' : 'Sign in';
    $('#setup-name').classList.toggle('hidden', !state.setupRequired);
    $('#setup-token-row').classList.toggle('hidden', !state.setupRequired);
    $('#password').autocomplete = state.setupRequired ? 'new-password' : 'current-password';
    return;
  }
  $('#user-chip').textContent = `${state.user.name} · ${state.user.role}`;
  await loadDeals();
  const dealId = new URLSearchParams(location.search).get('deal');
  if (dealId && state.deals.some((d) => d.id === dealId)) await selectDeal(dealId, false);
  render();
}
async function loadDeals() { state.deals = await request('/deals'); }
async function selectDeal(dealId, repaint = true) {
  const [deal, files, findings, activity] = await Promise.all([
    request(`/deals/${dealId}`), request(`/deals/${dealId}/documents`), request(`/deals/${dealId}/findings`), request(`/deals/${dealId}/activity`),
  ]);
  state.deal = deal; state.files = files; state.findings = findings; state.activity = activity;
  if (deal.can_manage) [state.users, state.grants] = await Promise.all([request('/users'), request(`/deals/${dealId}/access`)]);
  else { state.users = []; state.grants = []; }
  history.replaceState({}, '', `/app?deal=${encodeURIComponent(dealId)}`);
  if (repaint) render();
}
function head(eyebrow, title, description, actions = '') {
  return `<div class="page-head"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${description}</p></div>${actions ? `<div class="head-actions">${actions}</div>` : ''}</div>`;
}
const card = (title, body, subtitle = '') => `<section class="card"><div class="card-head"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div></div>${body}</section>`;
const roleManager = () => state.user && ['owner', 'admin'].includes(state.user.role);

function dashboard() {
  const countFiles = state.deal ? state.files.length : '—';
  const countFindings = state.deal ? state.findings.length : '—';
  const high = state.deal ? state.findings.filter((f) => ['P0', 'P1'].includes(f.severity)).length : '—';
  const visible = state.deals.filter((d) => `${d.name} ${d.target}`.toLowerCase().includes(state.filter.toLowerCase()));
  const rows = visible.length ? visible.map((d) => `<tr class="table-row" data-deal="${escapeHtml(d.id)}"><td><span class="table-main">${escapeHtml(d.name)}</span><span class="table-sub">${escapeHtml(d.target)}</span></td><td><span class="pill warn">${escapeHtml(d.stage)}</span></td><td>${stamp(d.updated_at)}</td><td><button class="button small" data-deal="${escapeHtml(d.id)}">Open room ↗</button></td></tr>`).join('') : `<tr><td colspan="4" class="empty">No matching deal rooms. ${roleManager() ? 'Create the first one to begin.' : 'Ask an owner to grant access.'}</td></tr>`;
  return head('INDEPENDENT SYSTEM', 'Deal overview', 'Track every deal from first look to an evidence-backed decision.', `<a href="/presentation.html" target="_blank" rel="noopener noreferrer" class="button">↗ Source presentation</a>`) +
    `<section class="hero"><span class="eyebrow">M&A DILIGENCE / WORKSPACE</span><h2>The complete picture of every deal.</h2><p>Keep confidential files in a restricted room, connect findings to exact quotes, and record who reviewed each conclusion.</p></section>` +
    `<div class="metrics"><section class="card"><span class="metric-label">VISIBLE DEALS</span><div class="metric-value">${state.deals.length}</div><div class="metric-note">Rooms you may access</div></section><section class="card"><span class="metric-label">SELECTED ROOM FILES</span><div class="metric-value">${countFiles}</div><div class="metric-note">Encrypted documents</div></section><section class="card"><span class="metric-label">SELECTED ROOM FINDINGS</span><div class="metric-value">${countFindings}</div><div class="metric-note">Draft and team reviewed</div></section><section class="card"><span class="metric-label">PRIORITY RISKS</span><div class="metric-value">${high}</div><div class="metric-note">P0 and P1 in selected room</div></section></div>` +
    `<div class="grid-two">${card('Deal rooms', `<label for="deal-search">Search deals</label><input id="deal-search" placeholder="Search by deal or target" value="${escapeHtml(state.filter)}"><table class="data-table"><thead><tr><th>Deal / target</th><th>Stage</th><th>Updated</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table>`, 'Select a room to inspect its real records')}${roleManager() ? card('Start a new deal', `<form id="create-deal" class="stack"><div><label for="deal-name">Deal name</label><input id="deal-name" minlength="2" maxlength="140" placeholder="Project Nile" required></div><div><label for="deal-target">Target company</label><input id="deal-target" minlength="2" maxlength="140" placeholder="Company name" required></div><button class="button primary" type="submit">＋ Create restricted room</button></form><p class="footer-note">Owners and admins see every deal. All other members require a separate grant.</p>`) : card('Your access', '<p class="hint">Only explicitly shared rooms appear here. Your role and permissions determine which actions are available.</p>')}</div>`;
}
function dealSidebar() {
  const list = state.deals.length ? state.deals.map((d) => `<button data-deal="${escapeHtml(d.id)}" class="${state.deal?.id === d.id ? 'active' : ''}"><strong>${escapeHtml(d.name)}</strong><small>${escapeHtml(d.target)}</small></button>`).join('') : '<p class="empty">No deal rooms</p>';
  return card('Deal rooms', `<div class="deal-list">${list}</div>`, 'Visible to your account');
}
function overviewTab() {
  const d = state.deal;
  return `<div class="metrics"><section class="card"><span class="metric-label">DOCUMENTS</span><div class="metric-value">${state.files.length}</div><div class="metric-note">Stored with encryption</div></section><section class="card"><span class="metric-label">FINDINGS</span><div class="metric-value">${state.findings.length}</div><div class="metric-note">All source statuses</div></section><section class="card"><span class="metric-label">MATCHED QUOTES</span><div class="metric-value">${state.findings.filter((f) => f.quote_matched).length}</div><div class="metric-note">Exact text only</div></section><section class="card"><span class="metric-label">REVIEWED</span><div class="metric-value">${state.findings.filter((f) => f.review_status === 'team-reviewed').length}</div><div class="metric-note">Team review recorded</div></section></div><div class="grid-two">${card('Room profile', `<div class="item"><div><strong>Deal name</strong><p>${escapeHtml(d.name)}</p></div></div><div class="item"><div><strong>Target company</strong><p>${escapeHtml(d.target)}</p></div></div><div class="item"><div><strong>Current stage</strong><p>${escapeHtml(d.stage)}</p></div></div><div class="item"><div><strong>Created</strong><p>${stamp(d.created_at)}</p></div></div>`)}${card('Evidence standard', `<div class="notice">Quote matching proves that wording exists in a stored text document. It does not prove the analysis is correct. PDF and DOCX citations need human source review.</div><p class="hint">AI-assisted is a label for analysis supplied by a reviewer. This system does not run third-party due diligence agents or produce legal advice.</p>`)}</div>`;
}
function documentsTab() {
  const items = state.files.length ? state.files.map((f) => `<div class="item"><div><strong>${escapeHtml(f.filename)}</strong><p>${bytes(f.size_bytes)} · SHA-256 ${escapeHtml(f.checksum.slice(0,14))}… · ${stamp(f.created_at)}</p></div><div class="item-actions"><button class="button small" data-download="${escapeHtml(f.id)}">↓ Download</button></div></div>`).join('') : '<div class="empty">No documents uploaded yet.</div>';
  const uploader = state.deal.can_write ? card('Add a confidential document', `<form id="upload-form" class="stack"><div><label for="upload-file">Choose file</label><input id="upload-file" class="file-input" type="file" accept=".pdf,.txt,.md,.csv,.docx" required></div><p class="hint">PDF, text, Markdown, CSV or DOCX · maximum 8 MB. Files are encrypted in the system database and are available only to authorised room members.</p><button class="button primary">↑ Upload securely</button></form>`) : '';
  return `<div class="stack">${card('Document room', items, 'Downloads are permission checked and audited')}${uploader}</div>`;
}
function findingsTab() {
  const items = state.findings.length ? state.findings.map((f) => `<div class="finding"><strong>${escapeHtml(f.title)}</strong><div style="margin-top:7px"><span class="pill ${f.severity==='P0'?'danger':f.severity==='P1'?'warn':''}">${escapeHtml(f.severity)}</span><span class="pill">${escapeHtml(f.domain)}</span><span class="pill ${f.quote_matched?'ok':'warn'}">${f.quote_matched?'Quote matched':'Source unverified'}</span><span class="pill">${escapeHtml(f.origin)}</span><span class="pill ${f.review_status==='team-reviewed'?'ok':''}">${escapeHtml(f.review_status)}</span></div><p>${escapeHtml(f.summary)}</p>${f.source_quote ? `<blockquote>“${escapeHtml(f.source_quote)}”<br>${escapeHtml(state.files.find((file)=>file.id===f.document_id)?.filename||'')} ${escapeHtml(f.source_location||'')}</blockquote>` : ''}${state.deal.can_manage&&f.review_status==='draft'?`<button class="button small" style="margin-top:12px" data-review="${escapeHtml(f.id)}" ${f.document_id&&!f.quote_matched?'disabled':''}>✓ Mark team reviewed</button>`:''}</div>`).join('') : '<div class="empty">No findings yet. Record the first observation with its source status.</div>';
  const form = state.deal.can_write ? card('Record a finding', `<form id="finding-form" class="form-grid"><label>Title<input name="title" minlength="3" maxlength="180" required></label><label>Domain<select name="domain">${['Legal','Finance','Commercial','Technology','Cyber','People','Tax','Regulatory','ESG'].map((d)=>`<option>${d}</option>`).join('')}</select></label><label>Priority<select name="severity"><option>P1</option><option>P0</option><option>P2</option><option>Info</option></select></label><label>Origin<select name="origin"><option value="manual">Manual analysis</option><option value="ai-assisted">AI-assisted analysis supplied by reviewer</option></select></label><label class="wide">Summary<textarea name="summary" minlength="10" maxlength="5000" required></textarea></label><label class="wide">Source document<select name="documentId"><option value="">No source selected</option>${state.files.map((file)=>`<option value="${escapeHtml(file.id)}">${escapeHtml(file.filename)}</option>`).join('')}</select></label><label class="wide">Exact source quote<textarea name="sourceQuote" maxlength="2000" placeholder="Required when a document is selected"></textarea></label><label class="wide">Page or location<input name="sourceLocation" maxlength="160"></label><button class="button primary wide" type="submit">＋ Save draft finding</button></form>`) : '';
  return `<div class="stack">${card('Due diligence findings',items,'Findings are work product, not verified professional conclusions')}${form}</div>`;
}
function accessTab() {
  const items = state.grants.length ? state.grants.map((g)=>`<div class="item"><div><strong>${escapeHtml(g.name)} · ${escapeHtml(g.role)}</strong><p>${escapeHtml(g.email)} · ${g.can_write?'Can write':'Read only'}</p></div><button class="button small" data-revoke="${escapeHtml(g.user_id)}">Revoke</button></div>`).join('') : '<div class="empty">No explicit grants yet.</div>';
  const choices = state.users.filter((u)=>!['owner','admin'].includes(u.role)).map((u)=>`<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)} · ${escapeHtml(u.role)}</option>`).join('');
  return `<div class="stack"><div class="notice">Owners and admins can access every deal. Analysts and viewers need an explicit grant. Viewers are always read only.</div>${card('Room access',items,'Grant and revoke actions are audited')}${card('Grant access',`<form id="grant-form" class="form-grid"><label>Member<select name="userId" required><option value="">Choose member</option>${choices}</select></label><label>Permission<select name="canWrite"><option value="false">Read only</option><option value="true">Can write (analysts only)</option></select></label><button class="button primary wide">Grant access</button></form>`)}</div>`;
}
function activityTab() {
  const items=state.activity.length?state.activity.map((a)=>`<div class="item"><div><strong>${escapeHtml(a.action)}</strong><p>${escapeHtml(a.actor)} · ${stamp(a.at)} ${a.target?'· '+escapeHtml(a.target):''}</p></div></div>`).join(''):'<div class="empty">No actions recorded yet.</div>';
  return card('Audit trail',items,'Latest 100 actions for this room');
}
function dealView() {
  const d=state.deal;
  const tabs=d?['overview','documents','findings',...(d.can_manage?['access']:[]),'activity']:[];
  const tabContent={overview:overviewTab,documents:documentsTab,findings:findingsTab,access:accessTab,activity:activityTab};
  return head('DEAL ROOM','Evidence workspace','Documents, cited findings, team access and the audit trail live together.',d?'<button id="export-report" class="button">↓ Export evidence report</button>':'')+
    `<div class="room-layout"><div class="side-panel">${dealSidebar()}</div><div>${d?`<section class="card" style="margin-bottom:16px"><span class="eyebrow">RESTRICTED ROOM</span><h2 style="margin:8px 0 5px">${escapeHtml(d.name)}</h2><p class="muted" style="font-size:13px;margin:0">${escapeHtml(d.target)} · ${escapeHtml(d.stage)}</p></section><div class="tabs">${tabs.map((t)=>`<button class="tab ${state.tab===t?'active':''}" data-tab="${t}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</div>${tabContent[state.tab]?.()||overviewTab()}`:card('Select a deal room','<div class="empty">Open a room from the list or create one on the overview page.</div>')}</div></div>`;
}
function teamView() {
  if(!roleManager()) return head('ACCESS','Team & access','Only owners and admins manage members.')+card('Restricted','<p class="hint">Ask an owner or admin to manage your account.</p>');
  const rows=state.users.map((u)=>`<div class="item"><div><strong>${escapeHtml(u.name)}</strong><p>${escapeHtml(u.email)}</p></div><span class="pill">${escapeHtml(u.role)}</span></div>`).join('');
  const history=state.teamActivity.length?state.teamActivity.map((a)=>`<div class="item"><div><strong>${escapeHtml(a.action)}</strong><p>${escapeHtml(a.actor)} · ${stamp(a.at)}${a.deal_name?' · '+escapeHtml(a.deal_name):''}</p></div></div>`).join(''):'<div class="empty">No actions recorded.</div>';
  return head('ACCESS','Team & access','Manage accounts here. Grant individual deal access inside each room.')+`<div class="grid-two">${card('Team members',rows||'<div class="empty">No members yet.</div>')}${card('Add a member',`<form id="member-form" class="stack"><div><label>Name</label><input name="name" minlength="2" required></div><div><label>Email</label><input name="email" type="email" required></div><div><label>Initial password</label><input name="password" type="password" minlength="10" required autocomplete="new-password"></div><div><label>Role</label><select name="role"><option value="analyst">Analyst</option><option value="viewer">Viewer</option><option value="admin">Admin</option></select></div><button class="button primary">Add member</button></form><p class="footer-note">Share the initial password privately outside the app. Email invitations and reset are not yet available.</p>`)}</div><div style="margin-top:17px">${card('Workspace audit',history,'Latest 100 actions across rooms and team setup')}</div>`;
}
function render() {
  const pages={dashboard:dashboard,deal:dealView,team:teamView};
  $('#content').innerHTML=(pages[state.view]||dashboard)();
  $('#breadcrumb-page').textContent={dashboard:'Overview',deal:'Deal room',team:'Team & access'}[state.view];
  document.querySelectorAll('[data-view]').forEach((button)=>button.classList.toggle('active',button.dataset.view===state.view));
  bindContent();
}
async function openDeal(dealId) { try { await selectDeal(dealId,false);state.view='deal';state.tab='overview';render(); } catch(error){onError(error);} }
function downloadBlob(name,blob){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function formValues(form){return Object.fromEntries(new FormData(form).entries());}
async function uploadFile(file) {
  if(!file||file.size===0||file.size>8*1024*1024) throw new Error('Choose a nonempty file under 8 MB.');
  const mime=file.type||({'.md':'text/markdown','.csv':'text/csv','.txt':'text/plain'}[file.name.match(/\.[^.]+$/)?.[0]]);
  if(!['application/pdf','text/plain','text/markdown','text/csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(mime)) throw new Error('Use PDF, text, Markdown, CSV or DOCX.');
  const contentBase64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('Could not read the file.'));reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(file);});
  return request(`/deals/${state.deal.id}/documents`,'POST',{filename:file.name,mimeType:mime,contentBase64});
}
function bindContent() {
  $('#deal-search')?.addEventListener('input',(event)=>{state.filter=event.target.value;const cursor=event.target.selectionStart;render();$('#deal-search').focus();$('#deal-search').setSelectionRange(cursor,cursor);});
  document.querySelectorAll('[data-deal]').forEach((el)=>el.addEventListener('click',()=>openDeal(el.dataset.deal)));
  document.querySelectorAll('[data-tab]').forEach((el)=>el.addEventListener('click',()=>{state.tab=el.dataset.tab;render();}));
  $('#create-deal')?.addEventListener('submit',async(event)=>{event.preventDefault();try{const d=await request('/deals','POST',{name:$('#deal-name').value,target:$('#deal-target').value});await loadDeals();await openDeal(d.id);toast('Restricted room created.');}catch(error){onError(error);}});
  $('#upload-form')?.addEventListener('submit',async(event)=>{event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;try{await uploadFile($('#upload-file').files[0]);await selectDeal(state.deal.id);toast('Encrypted document saved.');}catch(error){onError(error);}finally{button.disabled=false;}});
  document.querySelectorAll('[data-download]').forEach((el)=>el.addEventListener('click',async()=>{try{const file=state.files.find((f)=>f.id===el.dataset.download);const response=await fetch(`/api/deals/${state.deal.id}/documents/${file.id}/download`,{credentials:'same-origin'});if(!response.ok)throw new Error('Download denied.');downloadBlob(file.filename,await response.blob());}catch(error){onError(error);}}));
  $('#finding-form')?.addEventListener('submit',async(event)=>{event.preventDefault();try{const values=formValues(event.target);await request(`/deals/${state.deal.id}/findings`,'POST',{...values,documentId:values.documentId||undefined,sourceQuote:values.sourceQuote||undefined,sourceLocation:values.sourceLocation||undefined});await selectDeal(state.deal.id);toast('Draft finding saved.');}catch(error){onError(error);}});
  document.querySelectorAll('[data-review]').forEach((el)=>el.addEventListener('click',async()=>{try{await request(`/deals/${state.deal.id}/findings/${el.dataset.review}/review`,'POST',{});await selectDeal(state.deal.id);toast('Team review recorded.');}catch(error){onError(error);}}));
  $('#export-report')?.addEventListener('click',async()=>{try{const report=await request(`/deals/${state.deal.id}/report`);downloadBlob(`${state.deal.name.replace(/[^a-z0-9-]/gi,'-')}-evidence.json`,new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));await selectDeal(state.deal.id,false);}catch(error){onError(error);}});
  $('#grant-form')?.addEventListener('submit',async(event)=>{event.preventDefault();try{const data=formValues(event.target);await request(`/deals/${state.deal.id}/access`,'POST',{userId:data.userId,canWrite:data.canWrite==='true'});await selectDeal(state.deal.id);toast('Access granted.');}catch(error){onError(error);}});
  document.querySelectorAll('[data-revoke]').forEach((el)=>el.addEventListener('click',async()=>{if(!confirm('Revoke this member’s deal access?'))return;try{await request(`/deals/${state.deal.id}/access/${el.dataset.revoke}`,'DELETE');await selectDeal(state.deal.id);toast('Access revoked.');}catch(error){onError(error);}}));
  $('#member-form')?.addEventListener('submit',async(event)=>{event.preventDefault();try{await request('/users','POST',formValues(event.target));[state.users,state.teamActivity]=await Promise.all([request('/users'),request('/activity')]);render();toast('Member account created.');}catch(error){onError(error);}});
}

$('#auth-form').addEventListener('submit',async(event)=>{event.preventDefault();$('#auth-error').textContent='';try{const email=$('#email').value,password=$('#password').value;if(state.setupRequired)await request('/setup','POST',{email,password,name:$('#name').value,setupToken:$('#setup-token').value||undefined});else await request('/login','POST',{email,password});await refresh();}catch(error){$('#auth-error').textContent=error.message;}});
$('#logout').addEventListener('click',async()=>{await request('/logout','POST',{}).catch(onError);state.deal=null;state.view='dashboard';history.replaceState({},'','/app');await refresh();});
$('#theme-toggle').addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=next;localStorage.setItem('ma-theme',next);$('#theme-toggle').textContent=next==='light'?'☀':'☾';});
document.querySelectorAll('[data-view]').forEach((el)=>el.addEventListener('click',async()=>{state.view=el.dataset.view;if(state.view==='team'&&roleManager())[state.users,state.teamActivity]=await Promise.all([request('/users'),request('/activity')]).catch(()=>[[],[]]);if(state.view==='deal'&&!state.deal&&state.deals.length)await selectDeal(state.deals[0].id,false);render();$('.sidebar').classList.remove('open');}));
$('#mobile-menu').addEventListener('click',()=>$('.sidebar').classList.toggle('open'));
refresh().catch(onError);
