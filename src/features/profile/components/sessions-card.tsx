import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CircleCheck, CircleX, LogOut, Monitor, Smartphone } from 'lucide-react';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useLoginHistory,
  useRevokeOtherSessions,
  useRevokeSession,
  useSessions,
} from '@/features/auth/api/auth-api';

const isMobile = (name: string | null) => /android|ios|iphone|ipad|mobile/i.test(name ?? '');

export function SessionsCard() {
  const { t } = useTranslation();
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const [confirmOthers, setConfirmOthers] = useState(false);
  const others = (sessions.data ?? []).filter((s) => !s.current).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.sessionsTitle')}</CardTitle>
        <CardDescription>{t('profile.sessionsDescription')}</CardDescription>
        <CardAction>
          <Button variant="outline" disabled={!others} onClick={() => setConfirmOthers(true)}>
            <LogOut aria-hidden /> {t('profile.signOutOthers')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-lg border">
          {sessions.isPending &&
            Array.from({ length: 2 }, (_, i) => (
              <li key={i} className="p-4">
                <Skeleton className="h-10" />
              </li>
            ))}
          {sessions.data?.map((s) => {
            const Icon = isMobile(s.deviceName) ? Smartphone : Monitor;
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {s.deviceName ?? t('profile.unknownDevice')}
                    {s.current && <StatusBadge tone="success">{t('profile.thisDevice')}</StatusBadge>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.ip ?? '—'} · {t('profile.lastActive', { time: formatRelativeTime(s.lastUsedAt) })}
                  </p>
                </div>
                {!s.current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={revoke.isPending && revoke.variables === s.id}
                    onClick={() =>
                      revoke.mutate(s.id, { onSuccess: () => toast.success(t('profile.sessionRevoked')) })
                    }
                  >
                    {t('profile.signOut')}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
      <ConfirmDialog
        open={confirmOthers}
        onOpenChange={setConfirmOthers}
        title={t('profile.signOutOthersTitle')}
        description={t('profile.signOutOthersText', { count: others })}
        confirmLabel={t('profile.signOutOthers')}
        destructive
        loading={revokeOthers.isPending}
        onConfirm={() =>
          revokeOthers.mutate(undefined, {
            onSuccess: () => {
              toast.success(t('profile.othersSignedOut'));
              setConfirmOthers(false);
            },
          })
        }
      />
    </Card>
  );
}

export function LoginHistoryCard() {
  const { t } = useTranslation();
  const history = useLoginHistory();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.historyTitle')}</CardTitle>
        <CardDescription>{t('profile.historyDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-lg border text-sm">
          {history.isPending && (
            <li className="p-4">
              <Skeleton className="h-24" />
            </li>
          )}
          {history.data?.length === 0 && (
            <li className="p-4 text-muted-foreground">{t('profile.noHistory')}</li>
          )}
          {history.data?.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              {h.success ? (
                <CircleCheck className="size-4 text-emerald-600" aria-label={t('profile.success')} />
              ) : (
                <CircleX className="size-4 text-red-600" aria-label={t('profile.failed')} />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate">{h.deviceName ?? t('profile.unknownDevice')}</p>
                <p className="text-xs text-muted-foreground">
                  {h.ip ?? '—'}
                  {!h.success &&
                    h.failureReason &&
                    ` · ${t(`profile.failure.${h.failureReason}`, { defaultValue: h.failureReason })}`}
                </p>
              </div>
              <time className="text-xs text-muted-foreground" dateTime={h.createdAt}>
                {formatDateTime(h.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
