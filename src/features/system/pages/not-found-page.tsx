import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileQuestion } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <EmptyState
      className="mt-10"
      icon={FileQuestion}
      title={t('common.notFound')}
      description={t('common.notFoundText')}
      action={
        <Button asChild>
          <Link to="/">{t('common.backToDashboard')}</Link>
        </Button>
      }
    />
  );
}
