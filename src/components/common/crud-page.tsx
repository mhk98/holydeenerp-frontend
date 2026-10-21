import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Resolver,
  type UseFormReturn,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import type { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useListParams } from '@/hooks/use-list-params';
import { usePermission } from '@/hooks/use-permission';
import type { ExportColumn } from '@/lib/export';
import { applyServerErrors } from '@/lib/form';
import type { Resource } from '@/lib/resource';
import { Can } from '@/components/common/can';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { DataTable, type DataTableFilter } from '@/components/common/data-table/data-table';
import { FormDrawer } from '@/components/common/form-drawer';
import { PageHeader, type Crumb } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FieldGroup } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';

/** Capitalise the first letter (English titles); Bangla is unaffected. */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface CrudPageProps<T extends { id: string; name?: string }, V extends FieldValues> {
  resource: Resource<T, unknown>;
  /** i18n prefix with title, description, entity, entities (e.g. "settings.warehouses"). */
  i18nKey: string;
  breadcrumbs?: Crumb[];
  columns: ColumnDef<T, unknown>[];
  schema: z.ZodType<V, FieldValues>;
  emptyValues: V;
  toValues: (row: T) => V;
  toPayload?: (values: V, row: T | null) => unknown;
  renderFields: (form: UseFormReturn<V>, ctx: { isEdit: boolean; row: T | null }) => ReactNode;
  filters?: DataTableFilter[];
  defaultSort?: string;
  exportColumns?: ExportColumn<T>[];
  /** Hide delete for rows that can't be deleted (e.g. the base currency). */
  canDelete?: (row: T) => boolean;
  /** Extra actions in the row menu. */
  rowActions?: (row: T) => ReactNode;
  /** Content above the table (e.g. help text). */
  intro?: ReactNode;
  /** Permission module ("settings" → settings.create/update/delete). */
  permission?: string;
  drawerClassName?: string;
  rowLabel?: (row: T) => string;
  /** Inside another page (e.g. a tab): no page header; "New" moves into the table toolbar. */
  embedded?: boolean;
  /** Extra buttons next to "New" (e.g. the Excel import/export menu). */
  headerActions?: ReactNode;
  /** Extra drawer content outside the form fields, e.g. a logo uploader for saved rows. */
  drawerExtra?: (row: T | null) => ReactNode;
}

/**
 * List + create/edit drawer + delete confirmation for a REST resource. Pages only describe
 * their columns and form fields; behaviour (pagination, validation, server errors, toasts,
 * permissions) is shared.
 */
export function CrudPage<T extends { id: string; name?: string }, V extends FieldValues>({
  resource,
  i18nKey,
  breadcrumbs,
  columns,
  schema,
  emptyValues,
  toValues,
  toPayload,
  renderFields,
  filters = [],
  defaultSort = 'name',
  exportColumns,
  canDelete,
  rowActions,
  intro,
  permission = 'settings',
  drawerClassName,
  rowLabel = (row) => row.name ?? row.id,
  embedded = false,
  headerActions,
  drawerExtra,
}: CrudPageProps<T, V>) {
  const { t } = useTranslation();
  const { can } = usePermission();
  const entity = t(`${i18nKey}.entity`);
  const entities = t(`${i18nKey}.entities`);

  const list = useListParams({ defaultSort, filterKeys: filters.map((f) => f.key) });
  const query = resource.useList(list.query);
  const save = resource.useSave();
  const remove = resource.useRemove();

  const [editing, setEditing] = useState<{ open: boolean; row: T | null }>({ open: false, row: null });
  const [toDelete, setToDelete] = useState<T | null>(null);

  // Generic forms: pin the resolver to V (CrudPage schemas validate form values without transforms).
  const form = useForm<V>({
    resolver: zodResolver(schema as never) as unknown as Resolver<V>,
    defaultValues: emptyValues as DefaultValues<V>,
  });
  useEffect(() => {
    if (editing.open) form.reset(editing.row ? toValues(editing.row) : emptyValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the drawer opens
  }, [editing.open, editing.row]);

  const open = (row: T | null) => setEditing({ open: true, row });

  const onSubmit = form.handleSubmit((values) =>
    save.mutate(
      { id: editing.row?.id, data: toPayload ? toPayload(values, editing.row) : values },
      {
        onSuccess: () => {
          toast.success(t(editing.row ? 'crud.updated' : 'crud.created', { entity: cap(entity) }));
          setEditing((e) => ({ ...e, open: false }));
        },
        onError: (err) => {
          if (!applyServerErrors(err, form.setError)) toast.error(err.message);
        },
      },
    ),
  );

  const allColumns = useMemo<ColumnDef<T, unknown>[]>(
    () => [
      ...columns,
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        meta: { headerClassName: 'w-12', cellClassName: 'text-right' },
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row: { original } }) => {
          const deletable = can(`${permission}.delete`) && (canDelete?.(original) ?? true);
          const extra = rowActions?.(original);
          if (!can(`${permission}.update`) && !deletable && !extra) return null;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('common.actionsFor', { name: rowLabel(original) })}
                >
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <Can permission={`${permission}.update`}>
                  <DropdownMenuItem onSelect={() => open(original)}>
                    <Pencil aria-hidden /> {t('common.edit')}
                  </DropdownMenuItem>
                </Can>
                {extra}
                {deletable && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(original)}>
                      <Trash2 aria-hidden /> {t('common.delete')}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open/setToDelete are stable setters
    [columns, t, can, permission, canDelete, rowActions],
  );

  const isEdit = Boolean(editing.row);
  const newButton = (
    <div className="flex items-center gap-2">
      {headerActions}
      <Can permission={`${permission}.create`}>
        <Button onClick={() => open(null)}>
          <Plus aria-hidden /> {t('crud.new', { entity })}
        </Button>
      </Can>
    </div>
  );

  return (
    <>
      {!embedded && (
        <PageHeader
          title={t(`${i18nKey}.title`)}
          description={t(`${i18nKey}.description`)}
          breadcrumbs={
            breadcrumbs ?? [{ label: t('nav.settings'), to: '/settings' }, { label: t(`${i18nKey}.title`) }]
          }
          actions={newButton}
        />
      )}
      {intro}

      <DataTable
        storageKey={i18nKey}
        columns={allColumns}
        data={query.data?.rows}
        total={query.data?.meta.total ?? 0}
        loading={query.isPending}
        fetching={query.isFetching}
        list={list}
        getRowId={(r) => r.id}
        searchPlaceholder={t('crud.search', { entities })}
        filters={filters}
        toolbarActions={embedded ? newButton : undefined}
        exporter={
          exportColumns && can(`${permission}.export`)
            ? {
                filename: i18nKey.split('.').pop() ?? 'export',
                title: t(`${i18nKey}.title`),
                columns: exportColumns,
                fetchAll: () => resource.fetchAll({ ...list.query, page: undefined, limit: undefined }),
              }
            : undefined
        }
        empty={{
          title: t('crud.emptyTitle', { entities }),
          action: can(`${permission}.create`) ? (
            <Button onClick={() => open(null)}>
              <Plus aria-hidden /> {t('crud.new', { entity })}
            </Button>
          ) : undefined,
        }}
      />

      <FormDrawer
        open={editing.open}
        onOpenChange={(o) => setEditing((e) => ({ ...e, open: o }))}
        title={t(isEdit ? 'crud.editTitle' : 'crud.createTitle', { entity })}
        onSubmit={onSubmit}
        submitting={save.isPending}
        submitLabel={isEdit ? t('common.saveChanges') : t('crud.create', { entity })}
        className={drawerClassName}
      >
        {editing.open ? (
          <FieldGroup>
            {renderFields(form, { isEdit, row: editing.row })}
            {drawerExtra?.(editing.row)}
          </FieldGroup>
        ) : (
          <Skeleton className="h-64" />
        )}
      </FormDrawer>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        destructive
        title={t('crud.deleteTitle', { entity })}
        description={toDelete && t('crud.deleteText', { name: rowLabel(toDelete) })}
        confirmLabel={t('common.delete')}
        loading={remove.isPending}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => {
              toast.success(t('crud.deleted', { entity: cap(entity) }));
              setToDelete(null);
            },
            onError: () => setToDelete(null),
          })
        }
      />
    </>
  );
}
