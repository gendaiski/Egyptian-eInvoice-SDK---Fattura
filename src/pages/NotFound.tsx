import { Compass } from 'lucide-react';
import { useI18n } from '@/i18n';
import { EmptyState, LinkButton } from '@/components/ui';

export function NotFound() {
  const { L } = useI18n();
  return (
    <div className="min-h-[60vh] grid place-items-center">
      <EmptyState icon={<Compass className="size-5" />} title={L('Page not found', 'الصفحة غير موجودة')} body={L('The link may be old, or the record was deleted.', 'قد يكون الرابط قديماً أو تم حذف السجل.')}
        action={<LinkButton to="/app" variant="primary">{L('Back to dashboard', 'العودة للوحة التحكم')}</LinkButton>} />
    </div>
  );
}
