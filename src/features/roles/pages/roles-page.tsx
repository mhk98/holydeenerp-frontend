import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { KeyRound, Lock, MoreHorizontal, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useListParams } from '@/hooks/use-list-params';
import { usePermission } from '@/hooks/use-permission';
import { formatNumber, formatRelativeTime } from '@/lib/format';
import type { Role } from '@/types';
import { Can } from '@/components/common/can';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { DataTable } from '@/components/common/data-table/data-table';
import { DataTableColumnHeader } from '@/components/common/data-table/data-table-column-header';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDeleteRole, usePermissionCatalog, useRoles } from '../api/roles-api';
import { RoleFormDialog } from '../components/role-form-dialog';

export default function RolesPage() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const list = useListParams({ defaultSort: 'name' });
  const roles = useRoles(list.query);
  const catalog = usePermissionCatalog();
  const totalPermissions = catalog.data?.permissions.length ?? 0;

  const [dialog, setDialog] = useState<{ open: boolean; role: Role | null }>({ open: false, role: null });
  const [toDelete, setToDelete] = useState<Role | null>(null);
  const remove = useDeleteRole();

  const columns = useMemo<ColumnDef<Role, unknown>[]>(
    () => [
      {
        id: 'name',
        enableHiding: false,
        meta: { label: t('roles.columns.role') },
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('roles.columns.role')} />,
        cell: ({ row: { original: r } }) => (
          <div className="min-w-56">
            <Link
              to={`/settings/roles/${r.id}`}
              className="inline-flex items-center gap-2 font-medium underline-offset-4 hover:underline"
            >
              {r.name}
              {r.isSystem && (
                <Badge variant="secondary" className="gap-1 font-normal">
                  <Lock className="size-3" aria-hidden /> {t('roles.system')}
                </Badge>
              )}
            </Link>
            {r.description && (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{r.description}</p>
            )}
          </div>
        ),
      },
      {
        id: 'usersCount',
        enableSorting: false,
        meta: { label: t('roles.columns.users') },
        header: t('roles.columns.users'),
        cell: ({ row }) => (
          <Link
            to={`/settings/users?roleId=${row.original.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Users className="size-3.5" aria-hidden /> {formatNumber(row.original.usersCount)}
          </Link>
        ),
      },
      {
        id: 'permissionsCount',
        enableSorting: false,
        meta: { label: t('roles.columns.permissions') },
        header: t('roles.columns.permissions'),
        cell: ({ row }) => {
          const pct = totalPermissions
            ? Math.round((row.original.permissionsCount / totalPermissions) * 100)
            : 0;
          return (
            <div className="flex min-w-40 items-center gap-2">
              <div
                className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
                role="meter"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t('roles.columns.permissions')}
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatNumber(row.original.permissionsCount)} / {formatNumber(totalPermissions)}
              </span>
            </div>
          );
        },
      },
      {
        id: 'createdAt',
        meta: { label: t('roles.columns.created') },
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('roles.columns.created')} />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{formatRelativeTime(row.original.createdAt)}</span>
        ),
      },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        meta: { headerClassName: 'w-12', cellClassName: 'text-right' },
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row: { original: r } }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t('common.actionsFor', { name: r.name })}>
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={`/settings/roles/${r.id}`}>
                  <KeyRound aria-hidden />{' '}
                  {r.isSystem || !can('users.update')
                    ? t('roles.viewPermissions')
                    : t('roles.editPermissions')}
                </Link>
              </DropdownMenuItem>
              {!r.isSystem && (
                <>
                  <Can permission="users.update">
                    <DropdownMenuItem onSelect={() => setDialog({ open: true, role: r })}>
                      <Pencil aria-hidden /> {t('roles.rename')}
                    </DropdownMenuItem>
                  </Can>
                  <Can permission="users.delete">
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(r)}>
                      <Trash2 aria-hidden /> {t('common.delete')}
                    </DropdownMenuItem>
                  </Can>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [t, can, totalPermissions],
  );

  return (
    <>
      <PageHeader
        title={t('roles.title')}
        description={t('roles.description')}
        breadcrumbs={[{ label: t('nav.settings') }, { label: t('roles.title') }]}
        actions={
          <Can permission="users.create">
            <Button onClick={() => setDialog({ open: true, role: null })}>
              <Plus aria-hidden /> {t('roles.new')}
            </Button>
          </Can>
        }
      />

      <DataTable
        storageKey="roles"
        columns={columns}
        data={roles.data?.rows}
        total={roles.data?.meta.total ?? 0}
        loading={roles.isPending}
        fetching={roles.isFetching}
        list={list}
        getRowId={(r) => r.id}
        searchPlaceholder={t('roles.search')}
        exporter={
          can('users.export')
            ? {
                filename: 'roles',
                title: t('roles.title'),
                columns: [
                  { header: t('roles.fields.name'), value: (r) => r.name },
                  { header: t('roles.fields.description'), value: (r) => r.description },
                  { header: t('roles.columns.users'), value: (r) => r.usersCount },
                  { header: t('roles.columns.permissions'), value: (r) => r.permissionsCount },
                ],
              }
            : undefined
        }
      />

      <RoleFormDialog
        open={dialog.open}
        role={dialog.role}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        destructive
        title={t('roles.deleteTitle')}
        description={toDelete && t('roles.deleteText', { name: toDelete.name })}
        confirmLabel={t('common.delete')}
        loading={remove.isPending}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => {
              toast.success(t('roles.deleted'));
              setToDelete(null);
            },
            onError: () => setToDelete(null),
          })
        }
      />
    </>
  );
}
