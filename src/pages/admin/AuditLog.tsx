import { Download, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useStore } from '@/store/store';
import { DATA_MODE, API_BASE } from '@/env';
import { Button, Card, Input, Mono, PageHeader, Select, Table, Td, Th, useToast } from '@/components/ui';

export function AuditLog() {
  const { db } = useStore();
  const { L, date } = useI18n();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const actions = [...new Set(db.admin.audit.map((a) => a.action))].sort();
  const rows = db.admin.audit.filter((a) => (!action || a.action === action) && (!q || `${a.actor} ${a.target} ${a.ip}`.toLowerCase().includes(q.toLowerCase())));
  const exportAudit = async () => {
    try {
      let blob: Blob;
      if (DATA_MODE === 'api') {
        const res = await fetch(`${API_BASE}/api/v1/operations/audit/export`, { credentials: 'include' });
        if (!res.ok) throw new Error(`Export failed (${res.status}).`);
        blob = await res.blob();
      } else blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), rows }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `fatura-audit-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { toast({ tone: 'bad', text: (e as Error).message }); }
  };
  return (
    <div className="animate-in">
      <PageHeader title={L('Audit log', 'سجل التدقيق')} description={L('Recorded sign-ins, submissions, credential changes and staff actions. Retention must be configured and verified on the production database.', 'تسجيل الدخول والإرسال وتغييرات الاعتماد وإجراءات الموظفين. يجب ضبط مدة الحفظ والتحقق منها في قاعدة الإنتاج.')}
        actions={<Button icon={<Download className="size-4" />} onClick={() => void exportAudit()}>{L('Export', 'تصدير')}</Button>} />
      <Card pad={false}>
        <div className="flex flex-wrap gap-2 p-4">
          <div className="relative flex-1 min-w-[220px] max-w-[340px]"><Search className="size-4 absolute start-3 top-1/2 -translate-y-1/2 text-ink-subtle" /><Input className="ps-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('Actor, target or IP', 'المنفذ أو الهدف أو IP')} aria-label={L('Search', 'بحث')} /></div>
          <Select className="w-auto" value={action} onChange={(e) => setAction(e.target.value)} aria-label={L('Action', 'الإجراء')}><option value="">{L('All actions', 'كل الإجراءات')}</option>{actions.map((a) => <option key={a}>{a}</option>)}</Select>
        </div>
        <Table>
          <thead><tr><Th>{L('Time', 'الوقت')}</Th><Th>{L('Actor', 'المنفذ')}</Th><Th>{L('Action', 'الإجراء')}</Th><Th>{L('Target', 'الهدف')}</Th><Th>{L('Tenant', 'الشركة')}</Th><Th>IP</Th></tr></thead>
          <tbody>{rows.map((a) => {
            const t = db.admin.tenants.find((x) => x.id === a.tenantId);
            return (
              <tr key={a.id}>
                <Td className="text-ink-muted whitespace-nowrap">{date(a.at, 'datetime')}</Td>
                <Td className="max-w-[220px] truncate">{a.actor}</Td>
                <Td><Mono className={a.action.startsWith('admin') ? 'text-warn' : ''}>{a.action}</Mono></Td>
                <Td className="text-ink-muted">{a.target}</Td>
                <Td>{t && <Link to={`/admin/tenants/${t.id}`} className="link">{t.name}</Link>}</Td>
                <Td><Mono className="text-ink-subtle">{a.ip}</Mono></Td>
              </tr>
            );
          })}</tbody>
        </Table>
      </Card>
    </div>
  );
}
