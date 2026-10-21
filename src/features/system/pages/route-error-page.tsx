import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';

/** Router-level error boundary: friendly message instead of a blank screen. */
export default function RouteErrorPage() {
  const { t } = useTranslation();
  const error = useRouteError();
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : undefined;

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <EmptyState
        className="w-full max-w-lg"
        icon={TriangleAlert}
        title={t('common.errorTitle')}
        description={
          <>
            {t('common.errorText')}
            {import.meta.env.DEV && detail && <code className="mt-3 block text-xs break-all">{detail}</code>}
          </>
        }
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}>
              {t('common.retry')}
            </Button>
            <Button asChild>
              <Link to="/">{t('common.backToDashboard')}</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
