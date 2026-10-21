import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { DatabaseBackup, Download, Trash2 } from 'lucide-react';
import { useListParams } from '@/hooks/use-list-params';
import { applyServerErrors } from '@/lib/form';
import { formatBytes, formatDateTime, formatNumber } from '@/lib/format';
import type { Backup } from '@/types';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { DataTable } from '@/components/common/data-table/data-table';
import { SelectField, SwitchField, TextField } from '@/components/common/fields';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge, type StatusTone } from '@/components/common/status-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import {
  downloadBackup,
  useBackups,
  useBackupSchedule,
  useCreateBackup,
  useDeleteBackup,
  useSaveBackupSchedule,
} from '../api/settings-api';
import { SettingsFormCard } from '../components/settings-form-card';

const TONE: Record<Backup['status'], StatusTone> = {
  completed: 'success',
  running: 'info',
  failed: 'danger',
};

const scheduleSchema = z.object({
  scheduleEnabled: z.boolean(),
  frequency: z.enum(['daily', 'weekly']),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'validation.time'),
  weekday: z.string(),
  retention: z.string().regex(/^([1-9]|[1-8]\d|90)$/, 'validation.retention'),
});
type ScheduleValues = z.infer<typeof scheduleSchema>;

function ScheduleCard() {
  const { t } = useTranslation();
  const schedule = useBackupSchedule();
  const save = useSaveBackupSchedule();
  const form = useForm<ScheduleValues>({ resolver: zodResolver(scheduleSchema) });
  const frequency = useWatch({ control: form.control, name: 'frequency' });

  useEffect(() => {
    if (schedule.data) {
      form.reset({
        ...schedule.data,
        weekday: String(schedule.data.weekday),
        retention: String(schedule.data.retention),
      });
    }
  }, [schedule.data, form]);

  if (!schedule.data) return <Skeleton className="h-64 rounded-xl" />;

  const weekdays = Array.from({ length: 7 }, (_, i) => ({
    value: String(i),
    label: t(`settings.backups.weekdays.${i}`),
  }));

  return (
    <SettingsFormCard
      title={t('settings.backups.scheduleTitle')}
      description={t('settings.backups.scheduleHint')}
      saving={save.isPending}
      dirty={form.formState.isDirty}
      onSubmit={form.handleSubmit((values) =>
        save.mutate(
          { ...values, weekday: Number(values.weekday), retention: Number(values.retention) },
          {
            onSuccess: () => toast.success(t('settings.saved')),
            onError: (err) => {
              if (!applyServerErrors(err, form.setError)) toast.error(err.message);
            },
          },
        ),
      )}
    >
      <SwitchField control={form.control} name="scheduleEnabled" label={t('settings.backups.enabled')} />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          control={form.control}
          name="frequency"
          label={t('settings.backups.frequency')}
          options={[
            { value: 'daily', label: t('settings.backups.daily') },
            { value: 'weekly', label: t('settings.backups.weekly') },
          ]}
        />
        {frequency === 'weekly' && (
          <SelectField
            control={form.control}
            name="weekday"
            label={t('settings.backups.weekday')}
            options={weekdays}
          />
        )}
        <TextField
          control={form.control}
          name="time"
          label={t('settings.backups.time')}
          type="time"
          description={t('settings.backups.timeHint')}
        />
      </div>
      <TextField
        control={form.control}
        name="retention"
        label={t('settings.backups.retention')}
        inputMode="numeric"
        description={t('settings.backups.retentionHint')}
      />
    </SettingsFormCard>
  );
}

export default function BackupsPage() {
  const { t } = useTranslation();
  const list = useListParams({ defaultSort: '-createdAt', filterKeys: ['type', 'status'] });
  const backups = useBackups(list.query);
  const create = useCreateBackup();
  const remove = useDeleteBackup();
  const [toDelete, setToDelete] = useState<Backup | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const onDownload = async (b: Backup) => {
    setDownloading(b.id);
    try {
      await downloadBackup(b);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDownloading(null);
    }
  };

  const columns = useMemo<ColumnDef<Backup, unknown>[]>(
    () => [
      {
        id: 'createdAt',
        enableHiding: false,
        meta: { label: t('settings.backups.created') },
        header: t('settings.backups.created'),
        enableSorting: false,
        cell: ({ row: { original: b } }) => (
          <div>
            <p className="font-medium">{formatDateTime(b.createdAt)}</p>
            <p className="font-mono text-xs text-muted-foreground">{b.fileName}</p>
          </div>
        ),
      },
      {
        id: 'type',
        meta: { label: t('fields.type') },
        enableSorting: false,
        header: t('fields.type'),
        cell: ({ row }) => (
          <Badge variant="outline">{t(`settings.backups.types.${row.original.type}`)}</Badge>
        ),
      },
      {
        id: 'status',
        meta: { label: t('common.status') },
        enableSorting: false,
        header: t('common.status'),
        cell: ({ row: { original: b } }) => (
          <StatusBadge tone={TONE[b.status]} className={b.error ? 'cursor-help' : undefined}>
            <span title={b.error ?? undefined}>{t(`settings.backups.statuses.${b.status}`)}</span>
          </StatusBadge>
        ),
      },
      {
        id: 'size',
        meta: { label: t('settings.backups.size') },
        enableSorting: false,
        header: t('settings.backups.size'),
        cell: ({ row: { original: b } }) => (
          <div className="tabular-nums">
            <p>{formatBytes(b.sizeBytes)}</p>
            <p className="text-xs text-muted-foreground">
              {t('settings.backups.contents', { tables: b.tablesCount, rows: formatNumber(b.rowsCount) })}
            </p>
          </div>
        ),
      },
      {
        id: 'creator',
        meta: { label: t('settings.backups.by') },
        enableSorting: false,
        header: t('settings.backups.by'),
        cell: ({ row }) => row.original.creator?.name ?? t('settings.backups.scheduler'),
      },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        meta: { cellClassName: 'text-right' },
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row: { original: b } }) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={!b.fileExists || downloading === b.id}
              onClick={() => onDownload(b)}
              aria-label={t('settings.backups.download')}
            >
              {downloading === b.id ? <Spinner /> : <Download aria-hidden />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={b.status === 'running'}
              onClick={() => setToDelete(b)}
              aria-label={t('common.delete')}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        ),
      },
    ],
    [t, downloading],
  );

  return (
    <>
      <PageHeader
        title={t('settings.backups.title')}
        description={t('settings.backups.description')}
        breadcrumbs={[{ label: t('nav.settings'), to: '/settings' }, { label: t('settings.backups.title') }]}
        actions={
          <Button
            onClick={() =>
              create.mutate(undefined, {
                onSuccess: (b) =>
                  toast.success(t('settings.backups.createdToast', { size: formatBytes(b.sizeBytes) })),
              })
            }
            disabled={create.isPending}
          >
            {create.isPending ? <Spinner /> : <DatabaseBackup aria-hidden />}
            {create.isPending ? t('settings.backups.creating') : t('settings.backups.create')}
          </Button>
        }
      />
      <Alert className="mb-4">
        <AlertDescription>{t('settings.backups.securityNote')}</AlertDescription>
      </Alert>
      <DataTable
        storageKey="settings.backups"
        columns={columns}
        data={backups.data?.rows}
        total={backups.data?.meta.total ?? 0}
        loading={backups.isPending}
        fetching={backups.isFetching}
        list={list}
        getRowId={(b) => b.id}
        filters={[
          {
            key: 'type',
            label: t('fields.type'),
            options: [
              { value: 'manual', label: t('settings.backups.types.manual') },
              { value: 'scheduled', label: t('settings.backups.types.scheduled') },
            ],
          },
        ]}
        empty={{ title: t('settings.backups.empty') }}
      />
      <div className="mt-6">
        <ScheduleCard />
      </div>
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        destructive
        title={t('settings.backups.deleteTitle')}
        description={toDelete?.fileName}
        confirmLabel={t('common.delete')}
        loading={remove.isPending}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => {
              toast.success(t('settings.backups.deleted'));
              setToDelete(null);
            },
            onError: () => setToDelete(null),
          })
        }
      />
    </>
  );
}
