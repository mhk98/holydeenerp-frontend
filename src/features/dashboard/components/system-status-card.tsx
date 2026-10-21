import { useTranslation } from 'react-i18next';
import { Database, RefreshCw, Server } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSystemHealth } from '../api/use-system-health';

type Status = 'up' | 'down' | 'checking';

function StatusRow({
  icon: Icon,
  label,
  status,
  detail,
}: {
  icon: typeof Server;
  label: string;
  status: Status;
  detail?: string;
}) {
  const { t } = useTranslation();
  const text = status === 'checking' ? t('dashboard.checking') : t(`dashboard.${status}`);
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {detail && <p className="truncate text-xs text-muted-foreground">{detail}</p>}
      </div>
      <Badge variant="outline" className="gap-1.5">
        <span
          aria-hidden
          className={cn(
            'size-2 rounded-full',
            status === 'up' && 'bg-emerald-500',
            status === 'down' && 'bg-red-500',
            status === 'checking' && 'animate-pulse bg-amber-500',
          )}
        />
        {text}
      </Badge>
    </div>
  );
}

export function SystemStatusCard() {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch, isFetching } = useSystemHealth();

  const apiStatus: Status = isPending ? 'checking' : isError ? 'down' : 'up';
  const dbStatus: Status = isPending ? 'checking' : (data?.checks.database.status ?? 'down');
  const latency = data?.checks.database.latencyMs;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.systemStatus')}</CardTitle>
        <CardDescription>{data ? `${data.app} · ${data.env}` : '/api/v1/health/ready'}</CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label={t('common.retry')}
          >
            <RefreshCw className={cn(isFetching && 'animate-spin')} aria-hidden />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <StatusRow icon={Server} label={t('dashboard.api')} status={apiStatus} />
        <StatusRow
          icon={Database}
          label={t('dashboard.database')}
          status={dbStatus}
          detail={latency !== undefined ? `${formatNumber(latency)} ms` : data?.checks.database.error}
        />
      </CardContent>
    </Card>
  );
}

/** One-line system status for the foot of the dashboard. */
export function SystemStatusLine() {
  const { t } = useTranslation();
  const { data, isPending, isError } = useSystemHealth();
  const apiStatus: Status = isPending ? 'checking' : isError ? 'down' : 'up';
  const dbStatus: Status = isPending ? 'checking' : (data?.checks.database.status ?? 'down');
  const latency = data?.checks.database.latencyMs;
  const dot = (s: Status) =>
    cn(
      'size-1.5 rounded-full',
      s === 'up' && 'bg-emerald-500',
      s === 'down' && 'bg-red-500',
      s === 'checking' && 'animate-pulse bg-amber-500',
    );
  const text = (s: Status) => (s === 'checking' ? t('dashboard.checking') : t(`dashboard.${s}`));
  return (
    <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-4 text-xs text-muted-foreground">
      <span>{t('dashboard.systemStatus')}</span>
      <span className="flex items-center gap-1.5">
        <span className={dot(apiStatus)} aria-hidden />
        {t('dashboard.api')}: {text(apiStatus)}
      </span>
      <span className="flex items-center gap-1.5">
        <span className={dot(dbStatus)} aria-hidden />
        {t('dashboard.database')}: {text(dbStatus)}
        {latency != null && ` · ${formatNumber(latency)} ms`}
      </span>
    </footer>
  );
}
