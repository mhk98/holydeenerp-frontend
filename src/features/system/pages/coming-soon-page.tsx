import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Construction } from 'lucide-react';
import type { NavItem } from '@/app/navigation';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';

/** Placeholder for navigation entries whose module hasn't been built yet. */
export default function ComingSoonPage({ item, group }: { item: NavItem; group: string }) {
  const { t } = useTranslation();
  const title = t(`nav.${item.key}`);

  return (
    <>
      <PageHeader title={title} breadcrumbs={[{ label: t(`nav.${group}`) }, { label: title }]} />
      <EmptyState
        icon={item.icon ?? Construction}
        title={t('common.comingSoon')}
        description={t('common.comingSoonText', { module: title })}
        action={
          <Button asChild variant="outline">
            <Link to="/">{t('common.backToDashboard')}</Link>
          </Button>
        }
      />
    </>
  );
}
