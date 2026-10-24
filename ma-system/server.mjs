import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { z, ZodError } from 'zod';
import { getDb } from './db.mjs';
import { checksum, clearSession, decrypt, encrypt, hashPassword, id, issueSession, sessionUser, verifyPassword } from './security.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const app = new Hono();
const bad = (code, message, status = 400) => new Response(JSON.stringify({ error: { code, message } }), { status, headers: { 'Content-Type': 'application/json' } });
const requireUser = (c) => { const user = c.get('user'); if (!user) throw Object.assign(new Error('Sign in to continue.'), { status: 401, code: 'unauthenticated' }); return user; };
const manager = (u) => u.role === 'owner' || u.role === 'admin';
const requireManager = (c) => { const u = requireUser(c); if (!manager(u)) throw Object.assign(new Error('Owner or admin access required.'), { status: 403, code: 'forbidden' }); return u; };
const fail = (status, code, message) => { throw Object.assign(new Error(message), { status, code }); };
const input = async (c, schema) => schema.parse(await c.req.json().catch(() => fail(400, 'invalid_json', 'Send a JSON body.')));
const credentials = z.object({ email: z.email().max(240).transform((s) => s.toLowerCase()), password: z.string().min(10).max(200) });
const setupSchema = credentials.extend({ name: z.string().trim().min(2).max(120), setupToken: z.string().optional() });
const memberSchema = credentials.extend({ name: z.string().trim().min(2).max(120), role: z.enum(['admin', 'analyst', 'viewer']) });
const dealSchema = z.object({ name: z.string().trim().min(2).max(140), target: z.string().trim().min(2).max(140) });
const grantSchema = z.object({ userId: z.string().uuid(), canWrite: z.boolean() });
const fileSchema = z.object({
  filename: z.string().trim().min(1).max(180),
  mimeType: z.enum(['application/pdf','text/plain','text/markdown','text/csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  contentBase64: z.string().min(4).max(11_200_000),
});
const findingSchema = z.object({
  title: z.string().trim().min(3).max(180), domain: z.enum(['Legal','Finance','Commercial','Technology','Cyber','People','Tax','Regulatory','ESG']),
  severity: z.enum(['P0','P1','P2','Info']), origin: z.enum(['manual','ai-assisted']),
  summary: z.string().trim().min(10).max(5000), documentId: z.string().uuid().optional(),
  sourceQuote: z.string().trim().max(2000).optional(), sourceLocation: z.string().trim().max(160).optional(),
});
const loginAttempts = new Map();

app.use('/api/*', async (c, next) => {
  c.header('Cache-Control', 'private, no-store');
  c.header('X-Content-Type-Options', 'nosniff');
  const origin = c.req.header('origin');
  if (!['GET','HEAD','OPTIONS'].includes(c.req.method) && origin && origin !== new URL(c.req.url).origin) {
    return bad('origin_not_allowed', 'This request came from another site.', 403);
  }
  const db = await getDb();
  c.set('db', db);
  c.set('user', await sessionUser(c, db));
  await next();
});

async function dealFor(c, dealId, write = false) {
  const u = requireUser(c);
  const db = c.get('db');
  const [deal] = await db.query('SELECT id,name,target,stage,created_by,created_at,updated_at FROM ma_deals WHERE id=$1', [dealId]);
  if (!deal) fail(404, 'deal_not_found', 'Deal not found.');
  if (manager(u)) return { ...deal, can_write: true, can_manage: true };
  const [grant] = await db.query('SELECT can_write FROM ma_access WHERE deal_id=$1 AND user_id=$2', [dealId,u.id]);
  if (!grant || (write && (!grant.can_write || u.role === 'viewer'))) fail(404, 'deal_not_found', 'Deal not found.');
  return { ...deal, can_write: grant.can_write && u.role !== 'viewer', can_manage: false };
}
const audit = async (c, action, dealId, target = '') => c.get('db').query('INSERT INTO ma_audit(id,actor_id,action,deal_id,target) VALUES($1,$2,$3,$4,$5)', [id(),requireUser(c).id,action,dealId,target]);

app.get('/api/bootstrap', async (c) => {
  const [row] = await c.get('db').query('SELECT count(*)::int AS count FROM ma_users');
  return c.json({ setupRequired: row.count === 0, user: c.get('user') || null, storage: c.get('db').kind });
});
app.post('/api/setup', async (c) => {
  const data = await input(c, setupSchema);
  const [row] = await c.get('db').query('SELECT count(*)::int AS count FROM ma_users');
  if (row.count !== 0) fail(409, 'already_setup', 'The first owner already exists.');
  const expected = process.env.MA_SETUP_TOKEN;
  const localOnly = !process.env.MA_HOST || ['127.0.0.1','localhost','::1'].includes(process.env.MA_HOST);
  if (((!localOnly || process.env.NODE_ENV === 'production') && !expected) || (expected && data.setupToken !== expected)) fail(403, 'setup_token_required', 'A server setup token is required for remote first-time setup.');
  const user = { id: id(), name: data.name, email: data.email, role: 'owner' };
  await c.get('db').query('INSERT INTO ma_users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)', [user.id,user.name,user.email,await hashPassword(data.password),user.role]);
  await c.get('db').query('INSERT INTO ma_audit(id,actor_id,action,deal_id,target) VALUES($1,$2,$3,$4,$5)', [id(),user.id,'workspace.setup',null,user.id]);
  await issueSession(c,user);
  return c.json({ user },201);
});
app.post('/api/login', async (c) => {
  const { email, password } = await input(c, credentials);
  const key = email;
  const entry = loginAttempts.get(key) || { count: 0, until: 0 };
  if (entry.count >= 5 && entry.until > Date.now()) fail(429,'try_later','Too many attempts. Try again in five minutes.');
  const [user] = await c.get('db').query('SELECT id,name,email,role,password_hash FROM ma_users WHERE email=$1', [email]);
  if (!user || !await verifyPassword(password,user.password_hash)) {
    loginAttempts.set(key,{ count: entry.count + 1, until: Date.now() + 300_000 });
    fail(401,'invalid_login','Email or password was incorrect.');
  }
  loginAttempts.delete(key);
  await issueSession(c,user);
  return c.json({ user: { id:user.id,name:user.name,email:user.email,role:user.role } });
});
app.post('/api/logout', (c) => { clearSession(c); return c.json({ ok:true }); });
app.get('/api/users', async (c) => { requireManager(c); return c.json(await c.get('db').query('SELECT id,name,email,role,created_at FROM ma_users ORDER BY name')); });
app.post('/api/users', async (c) => {
  requireManager(c);
  const data = await input(c, memberSchema);
  const user = { id: id(), name: data.name, email: data.email, role: data.role };
  await c.get('db').query('INSERT INTO ma_users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)', [user.id,user.name,user.email,await hashPassword(data.password),user.role]);
  await audit(c,'member.create',null,user.id);
  return c.json(user,201);
});
app.get('/api/activity', async (c) => {
  requireManager(c);
  return c.json(await c.get('db').query('SELECT a.at,a.action,a.target,d.name AS deal_name,u.name AS actor FROM ma_audit a JOIN ma_users u ON u.id=a.actor_id LEFT JOIN ma_deals d ON d.id=a.deal_id ORDER BY a.at DESC LIMIT 100'));
});
app.get('/api/deals', async (c) => {
  const u = requireUser(c);
  return c.json(await c.get('db').query(manager(u)
    ? 'SELECT id,name,target,stage,created_at,updated_at FROM ma_deals ORDER BY updated_at DESC'
    : 'SELECT d.id,d.name,d.target,d.stage,d.created_at,d.updated_at FROM ma_deals d JOIN ma_access a ON a.deal_id=d.id WHERE a.user_id=$1 ORDER BY d.updated_at DESC',
  manager(u) ? [] : [u.id]));
});
app.post('/api/deals', async (c) => {
  const u = requireManager(c);
  const { name,target } = await input(c,dealSchema);
  const dealId = id();
  await c.get('db').query('INSERT INTO ma_deals(id,name,target,created_by) VALUES($1,$2,$3,$4)', [dealId,name,target,u.id]);
  await audit(c,'deal.create',dealId);
  return c.json(await dealFor(c,dealId),201);
});
app.get('/api/deals/:id', async (c) => c.json(await dealFor(c,c.req.param('id'))));
app.get('/api/deals/:id/access', async (c) => {
  requireManager(c); await dealFor(c,c.req.param('id'));
  return c.json(await c.get('db').query('SELECT a.user_id,a.can_write,u.name,u.email,u.role FROM ma_access a JOIN ma_users u ON u.id=a.user_id WHERE a.deal_id=$1 ORDER BY u.name',[c.req.param('id')]));
});
app.post('/api/deals/:id/access', async (c) => {
  const u = requireManager(c); const dealId=c.req.param('id'); await dealFor(c,dealId);
  const data=await input(c,grantSchema);
  const [member]=await c.get('db').query('SELECT role FROM ma_users WHERE id=$1',[data.userId]);
  if (!member) fail(404,'member_not_found','Choose an existing team member.');
  if (data.canWrite && member.role==='viewer') fail(422,'viewer_read_only','Viewers cannot write.');
  await c.get('db').query('INSERT INTO ma_access(deal_id,user_id,can_write,granted_by) VALUES($1,$2,$3,$4) ON CONFLICT(deal_id,user_id) DO UPDATE SET can_write=EXCLUDED.can_write,granted_by=EXCLUDED.granted_by',[dealId,data.userId,data.canWrite,u.id]);
  await audit(c,'access.grant',dealId,data.userId); return c.json({ok:true});
});
app.delete('/api/deals/:id/access/:userId',async(c)=>{
  requireManager(c);const dealId=c.req.param('id');await dealFor(c,dealId);
  await c.get('db').query('DELETE FROM ma_access WHERE deal_id=$1 AND user_id=$2',[dealId,c.req.param('userId')]);
  await audit(c,'access.revoke',dealId,c.req.param('userId'));return c.json({ok:true});
});
app.get('/api/deals/:id/documents',async(c)=>{
  await dealFor(c,c.req.param('id'));
  return c.json(await c.get('db').query('SELECT id,filename,mime_type,size_bytes,checksum,uploaded_by,created_at FROM ma_documents WHERE deal_id=$1 ORDER BY created_at DESC',[c.req.param('id')]));
});
app.post('/api/deals/:id/documents',async(c)=>{
  const dealId=c.req.param('id');await dealFor(c,dealId,true);
  const data=await input(c,fileSchema);
  if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data.contentBase64)) fail(422,'bad_file','File content must be valid base64.');
  const content=Buffer.from(data.contentBase64,'base64');
  if(!content.length||content.length>8*1024*1024) fail(413,'file_too_large','Files must be between 1 byte and 8 MB.');
  const documentId=id(); const filename=data.filename.replace(/[\\/\u0000-\u001f\u007f]/g,'_');
  await c.get('db').query('INSERT INTO ma_documents(id,deal_id,filename,mime_type,size_bytes,checksum,content_enc,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[documentId,dealId,filename,data.mimeType,content.length,checksum(content),await encrypt(content),requireUser(c).id]);
  await c.get('db').query('UPDATE ma_deals SET updated_at=now() WHERE id=$1',[dealId]);
  await audit(c,'document.upload',dealId,documentId);
  return c.json({id:documentId,filename,mime_type:data.mimeType,size_bytes:content.length,checksum:checksum(content)},201);
});
app.get('/api/deals/:id/documents/:documentId/download',async(c)=>{
  const dealId=c.req.param('id');await dealFor(c,dealId);
  const [file]=await c.get('db').query('SELECT filename,content_enc FROM ma_documents WHERE deal_id=$1 AND id=$2',[dealId,c.req.param('documentId')]);
  if(!file) fail(404,'file_not_found','Document not found.');
  await audit(c,'document.download',dealId,c.req.param('documentId'));
  return new Response(await decrypt(file.content_enc),{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
});
app.get('/api/deals/:id/findings',async(c)=>{
  await dealFor(c,c.req.param('id'));
  return c.json(await c.get('db').query('SELECT id,title,domain,severity,origin,summary,document_id,source_quote,source_location,quote_matched,review_status,reviewed_by,reviewed_at,created_at FROM ma_findings WHERE deal_id=$1 ORDER BY created_at DESC',[c.req.param('id')]));
});
app.post('/api/deals/:id/findings',async(c)=>{
  const dealId=c.req.param('id');await dealFor(c,dealId,true);
  const data=await input(c,findingSchema);
  if(!!data.documentId!==!!data.sourceQuote) fail(422,'citation_required','Select a source document and enter a quote together.');
  let matched=false;
  if(data.documentId){
    const [file]=await c.get('db').query('SELECT mime_type,content_enc FROM ma_documents WHERE deal_id=$1 AND id=$2',[dealId,data.documentId]);
    if(!file) fail(404,'file_not_found','Source document is not in this deal.');
    if(file.mime_type.startsWith('text/')) matched=(await decrypt(file.content_enc)).toString('utf8').includes(data.sourceQuote);
  }
  const findingId=id();
  await c.get('db').query('INSERT INTO ma_findings(id,deal_id,title,domain,severity,origin,summary,document_id,source_quote,source_location,quote_matched,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[findingId,dealId,data.title,data.domain,data.severity,data.origin,data.summary,data.documentId||null,data.sourceQuote||null,data.sourceLocation||null,matched,requireUser(c).id]);
  await c.get('db').query('UPDATE ma_deals SET updated_at=now() WHERE id=$1',[dealId]);
  await audit(c,'finding.create',dealId,findingId);
  return c.json({id:findingId,quote_matched:matched,review_status:'draft',...data},201);
});
app.post('/api/deals/:id/findings/:findingId/review',async(c)=>{
  const u=requireManager(c);const dealId=c.req.param('id');await dealFor(c,dealId);
  const [finding]=await c.get('db').query('SELECT document_id,quote_matched FROM ma_findings WHERE deal_id=$1 AND id=$2',[dealId,c.req.param('findingId')]);
  if(!finding) fail(404,'finding_not_found','Finding not found.');
  if(finding.document_id&&!finding.quote_matched) fail(422,'unmatched_quote','The quoted text was not matched. Resolve its source before review.');
  await c.get('db').query("UPDATE ma_findings SET review_status='team-reviewed',reviewed_by=$3,reviewed_at=now() WHERE deal_id=$1 AND id=$2",[dealId,c.req.param('findingId'),u.id]);
  await audit(c,'finding.review',dealId,c.req.param('findingId'));return c.json({ok:true});
});
app.get('/api/deals/:id/report',async(c)=>{
  const dealId=c.req.param('id');const deal=await dealFor(c,dealId);
  const documents=await c.get('db').query('SELECT id,filename,mime_type,size_bytes,checksum,created_at FROM ma_documents WHERE deal_id=$1 ORDER BY created_at',[dealId]);
  const findings=await c.get('db').query('SELECT id,title,domain,severity,origin,summary,document_id,source_quote,source_location,quote_matched,review_status,reviewed_by,reviewed_at,created_at FROM ma_findings WHERE deal_id=$1 ORDER BY created_at',[dealId]);
  await audit(c,'report.export',dealId);
  return c.json({deal,documents,findings,generatedAt:new Date().toISOString(),note:'Draft work product. A matched quote proves wording only; AI-assisted analysis is not a verified fact or professional conclusion.'});
});
app.get('/api/deals/:id/activity',async(c)=>{
  const dealId=c.req.param('id');await dealFor(c,dealId);
  return c.json(await c.get('db').query('SELECT a.at,a.action,a.target,u.name AS actor FROM ma_audit a JOIN ma_users u ON u.id=a.actor_id WHERE a.deal_id=$1 ORDER BY a.at DESC LIMIT 100',[dealId]));
});

app.get('/api/health',async(c)=>c.json({ok:true,storage:c.get('db').kind}));
app.onError((error,c)=>{
  if(error instanceof ZodError) return bad('invalid_input',error.issues.map((issue)=>`${issue.path.join('.')}: ${issue.message}`).join('; '),422);
  if(error.code==='23505') return bad('already_exists','That email or record already exists.',409);
  if(error.status) return bad(error.code||'request_failed',error.message,error.status);
  console.error('MA request failed:',error);
  return bad('internal_error','The request failed. Check the server log.',500);
});

const assets=new Map([
  ['/','web/index.html'],['/app','web/index.html'],['/styles.css','web/styles.css'],['/app.js','web/app.js'],
  ['/presentation.html','public/presentation.html'],
  ['/screenshots/01-executive-dashboard.png','public/screenshots/01-executive-dashboard.png'],
  ['/screenshots/03-cross-domain-synthesis.png','public/screenshots/03-cross-domain-synthesis.png'],
]);
app.get('*',async(c)=>{
  const pathname=new URL(c.req.url).pathname;
  const file=assets.get(pathname);
  if(!file) return c.notFound();
  const type=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'image/png';
  const headers={'Content-Type':type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
  if(pathname==='/presentation.html') headers['Content-Security-Policy']="default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
  if(pathname==='/'||pathname==='/app') headers['Content-Security-Policy']="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
  return new Response(await readFile(join(root,file)),{headers});
});

export { app };
if(process.argv[1]&&fileURLToPath(import.meta.url)===fileURLToPath(new URL(`file://${process.argv[1]}`))){
  await getDb();
  const host=process.env.MA_HOST||'127.0.0.1';
  const port=Number(process.env.MA_PORT||8797);
  serve({fetch:app.fetch,hostname:host,port},()=>console.log(`M&A Diligence System listening on http://${host}:${port} (${process.env.MA_DATABASE_URL?'Postgres':'PGlite'})`));
}
