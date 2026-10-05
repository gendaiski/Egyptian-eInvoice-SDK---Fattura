/**
 * Settings that only exist against the real Fatura server (VITE_DATA=api):
 * signer-agent pairing, integration API keys and webhooks. Secrets returned by
 * the server are shown exactly once.
 */
import { KeyRound, Plus, Trash2, Usb, Webhook } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '@/env';
import { useI18n } from '@/i18n';
import { api, reportApiError } from '@/lib/api';
import { useStore } from '@/store/store';
import { Badge, Button, Callout, Card, CopyButton, EmptyState, Field, Input, Modal, Mono, Table, Td, Th, useToast } from '@/components/ui';

const serverOrigin = () => API_BASE || window.location.origin;

function useList<T>(path: string) {
  const [rows, setRows] = useState<T[] | null>(null);
  const load = useCallback(async () => { try { setRows(await api<T[]>('GET', path)); } catch (e) { reportApiError(e); setRows([]); } }, [path]);
  useEffect(() => { load(); }, [load]);
  return { rows, load };
}

function SecretOnce({ value, note }: { value: string; note: string }) {
  return (
    <div className="space-y-2">
      <Callout tone="warn" title={note} />
      <div className="flex items-center gap-2 rounded-md border border-line bg-sunken/60 p-2.5">
        <Mono className="flex-1 break-all text-[12.5px]">{value}</Mono>
        <CopyButton value={value} />
      </div>
    </div>
  );
}

interface AgentRow { id: string; name: string; version: string | null; host: string | null; last_seen: string | null; created_at: string; revoked: boolean }

export function SignerAgents() {
  const { L, rel } = useI18n();
  const { reload } = useStore();
  const { rows, load } = useList<AgentRow>('/actions/signing/agents');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('Finance PC');
  const [issued, setIssued] = useState<{ token: string; note: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const pair = async () => {
    setBusy(true);
    try { const r = await api<{ token: string; note: string }>('POST', '/actions/signing/agents', { name }); setIssued(r); load(); } catch (e) { reportApiError(e); } finally { setBusy(false); }
  };
  const revoke = async (id: string) => { try { await api('DELETE', `/actions/signing/agents/${id}`); load(); reload(); } catch (e) { reportApiError(e); } };
  const close = () => { setOpen(false); setIssued(null); };
  const live = rows?.filter((r) => !r.revoked) ?? [];
  return (
    <Card title={L('Paired signers', 'أجهزة التوقيع المقترنة')} pad={false}
      subtitle={L('Each PC running Fatura Signer with a USB token gets its own token. Revoke a token when a PC is retired.', 'كل جهاز يشغّل برنامج التوقيع يحصل على رمز خاص. ألغِ الرمز عند الاستغناء عن الجهاز.')}
      action={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>{L('Pair a signer', 'إقران جهاز')}</Button>}>
      {rows && !live.length ? <EmptyState icon={<Usb />} title={L('No signer paired yet', 'لا يوجد جهاز مقترن')} body={L('Pair the PC that holds your USB token to sign documents for ETA.', 'اقرن الجهاز المتصل بالتوكن لتوقيع المستندات.')} /> : (
        <Table>
          <thead><tr><Th>{L('Name', 'الاسم')}</Th><Th>{L('Machine', 'الجهاز')}</Th><Th>{L('Last heartbeat', 'آخر اتصال')}</Th><Th /></tr></thead>
          <tbody>{live.map((a) => (
            <tr key={a.id}>
              <Td className="font-medium">{a.name}</Td>
              <Td className="text-ink-muted"><Mono>{a.host ?? '—'}</Mono>{a.version && <span className="ms-2 text-[12px]">v{a.version}</span>}</Td>
              <Td className="text-ink-muted">{a.last_seen ? rel(a.last_seen) : L('Never connected', 'لم يتصل بعد')}</Td>
              <Td align="end"><Button size="sm" variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => revoke(a.id)}>{L('Revoke', 'إلغاء')}</Button></Td>
            </tr>
          ))}</tbody>
        </Table>
      )}
      <Modal open={open} onClose={close} title={L('Pair Fatura Signer', 'إقران برنامج التوقيع')}
        footer={issued ? <Button variant="primary" onClick={close}>{L('Done', 'تم')}</Button> : <><Button onClick={close}>{L('Cancel', 'إلغاء')}</Button><Button variant="primary" loading={busy} disabled={!name.trim()} onClick={pair}>{L('Create token', 'إنشاء الرمز')}</Button></>}>
        {issued ? (
          <div className="space-y-4">
            <SecretOnce value={issued.token} note={L('Copy this token now — it is shown only once.', 'انسخ الرمز الآن — يظهر مرة واحدة فقط.')} />
            <div>
              <span className="label">{L('Run on the PC with the token', 'شغّل على الجهاز المتصل بالتوكن')}</span>
              <pre className="rounded-md bg-ink text-canvas p-3 text-[12px] overflow-x-auto" dir="ltr">{`FATURA_URL=${serverOrigin()} \\
FATURA_AGENT_TOKEN=${issued.token.slice(0, 14)}… \\
SIGNER=pkcs11 PKCS11_LIB=/path/to/eps2003csp11.dll PKCS11_PIN=•••• \\
npx tsx signer-agent/agent.ts`}</pre>
            </div>
          </div>
        ) : (
          <Field label={L('Name this PC', 'اسم الجهاز')}>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        )}
      </Modal>
    </Card>
  );
}

interface KeyRow { id: string; name: string; prefix: string; last_used: string | null; created_at: string; revoked: boolean }
interface HookRow { id: string; url: string; events: string[]; active: boolean; created_at: string }

export function DevelopersSection() {
  const { L, rel, date } = useI18n();
  const toast = useToast();
  const keys = useList<KeyRow>('/actions/api-keys');
  const hooks = useList<HookRow>('/actions/webhooks');
  const [keyName, setKeyName] = useState('');
  const [hookUrl, setHookUrl] = useState('');
  const [issued, setIssued] = useState<{ value: string; note: string } | null>(null);
  const createKey = async () => {
    try { const r = await api<{ key: string; note: string }>('POST', '/actions/api-keys', { name: keyName || 'ERP' }); setIssued({ value: r.key, note: L('Copy this API key now — it is shown only once.', 'انسخ المفتاح الآن — يظهر مرة واحدة فقط.') }); setKeyName(''); keys.load(); } catch (e) { reportApiError(e); }
  };
  const createHook = async () => {
    try { const r = await api<{ secret: string }>('POST', '/actions/webhooks', { url: hookUrl }); setIssued({ value: r.secret, note: L('Signing secret for X-Fatura-Signature — shown only once.', 'سر التحقق من X-Fatura-Signature — يظهر مرة واحدة فقط.') }); setHookUrl(''); hooks.load(); } catch (e) { reportApiError(e); }
  };
  const del = async (path: string, after: () => void) => { try { await api('DELETE', path); after(); toast({ tone: 'ok', text: L('Removed.', 'تم الحذف.') }); } catch (e) { reportApiError(e); } };
  return (
    <>
      <Card title={L('API keys', 'مفاتيح الواجهة البرمجية')} pad={false}
        subtitle={<>{L('Let your ERP create and submit documents through the Fatura API:', 'اسمح لنظامك بإنشاء وإرسال المستندات عبر واجهة فاتورة:')} <Mono>{serverOrigin()}/api/v1/ext</Mono></>}>
        <div className="flex flex-wrap gap-2 p-4 border-b border-line">
          <Input className="max-w-xs" placeholder={L('Key name, e.g. Odoo production', 'اسم المفتاح')} value={keyName} onChange={(e) => setKeyName(e.target.value)} aria-label={L('Key name', 'اسم المفتاح')} />
          <Button variant="primary" icon={<KeyRound className="size-4" />} onClick={createKey}>{L('Create key', 'إنشاء مفتاح')}</Button>
        </div>
        <Table>
          <thead><tr><Th>{L('Name', 'الاسم')}</Th><Th>{L('Key', 'المفتاح')}</Th><Th>{L('Last used', 'آخر استخدام')}</Th><Th /></tr></thead>
          <tbody>{(keys.rows ?? []).map((k) => (
            <tr key={k.id}>
              <Td className="font-medium">{k.name}</Td>
              <Td><Mono className="text-ink-muted">{k.prefix}…</Mono></Td>
              <Td className="text-ink-muted">{k.revoked ? <Badge tone="bad">{L('Revoked', 'ملغى')}</Badge> : k.last_used ? rel(k.last_used) : L('Never', 'لم يُستخدم')}</Td>
              <Td align="end">{!k.revoked && <Button size="sm" variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => del(`/actions/api-keys/${k.id}`, keys.load)}>{L('Revoke', 'إلغاء')}</Button>}</Td>
            </tr>
          ))}</tbody>
        </Table>
      </Card>
      <Card title={L('Webhooks', 'الإشعارات الآلية (Webhooks)')} pad={false}
        subtitle={L('Fatura POSTs document.validated, document.invalid, document.cancelled, received.created and more to your HTTPS endpoint, signed with HMAC-SHA256.', 'ترسل فاتورة أحداث المستندات إلى عنوانك موقّعة بـ HMAC-SHA256.')}>
        <div className="flex flex-wrap gap-2 p-4 border-b border-line">
          <Input className="max-w-md" dir="ltr" placeholder="https://erp.example.com/fatura/webhook" value={hookUrl} onChange={(e) => setHookUrl(e.target.value)} aria-label={L('Endpoint URL', 'عنوان الاستقبال')} />
          <Button variant="primary" icon={<Webhook className="size-4" />} disabled={!/^https:\/\/\S+/.test(hookUrl)} onClick={createHook}>{L('Add endpoint', 'إضافة عنوان')}</Button>
        </div>
        <Table>
          <thead><tr><Th>{L('Endpoint', 'العنوان')}</Th><Th>{L('Events', 'الأحداث')}</Th><Th>{L('Added', 'أضيف')}</Th><Th /></tr></thead>
          <tbody>{(hooks.rows ?? []).map((h) => (
            <tr key={h.id}>
              <Td><Mono className="break-all">{h.url}</Mono></Td>
              <Td className="text-ink-muted">{h.events.includes('*') ? L('All events', 'كل الأحداث') : h.events.join(', ')}</Td>
              <Td className="text-ink-muted">{date(h.created_at)}</Td>
              <Td align="end"><Button size="sm" variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => del(`/actions/webhooks/${h.id}`, hooks.load)}>{L('Remove', 'حذف')}</Button></Td>
            </tr>
          ))}</tbody>
        </Table>
      </Card>
      <Modal open={!!issued} onClose={() => setIssued(null)} title={L('Copy your secret', 'انسخ السر')} footer={<Button variant="primary" onClick={() => setIssued(null)}>{L('Done', 'تم')}</Button>}>
        {issued && <SecretOnce value={issued.value} note={issued.note} />}
      </Modal>
    </>
  );
}
