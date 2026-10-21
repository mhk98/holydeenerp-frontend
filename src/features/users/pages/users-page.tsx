import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Lock, MoreHorizontal, Pencil, Plus, ShieldCheck, Trash2, UserCheck, UserX } from 'lucide-react';
import { useListParams } from '@/hooks/use-list-params';
import { usePermission } from '@/hooks/use-permission';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { useAuthStore } from '@/stores/auth-store';
import type { User } from '@/types';
import { Can } from '@/components/common/can';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { DataTable } from '@/components/common/data-table/data-table';
import { DataTableColumnHeader } from '@/components/common/data-table/data-table-column-header';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { UserAvatar } from '@/components/common/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useBranches } from '@/features/branches/api/branches-api';
import { useRoles } from '@/features/roles/api/roles-api';
import { fetchAllUsers, useDeleteUser, useSetUserStatus, useUsers } from '../api/users-api';
import { UserFormDrawer } from '../components/user-form-drawer';

type Confirm =
  { kind: 'delete'; user: User } | { kind: 'bulk-status'; users: User[]; status: 'active' | 'inactive' };

export default function UsersPage() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const list = useListParams({ defaultSort: 'name', filterKeys: ['status', 'roleId', 'branchId'] });
  const users = useUsers(list.query);
  const roles = useRoles();
  const branches = useBranches();

  const [drawer, setDrawer] = useState<{ open: boolean; userId: string | null }>({
    open: false,
    userId: null,
  });
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const setStatus = useSetUserStatus();
  const remove = useDeleteUser();
  const [bulkPending, setBulkPending] = useState(false);

  const openEdit = (id: string | null) => setDrawer({ open: true, userId: id });

  const toggleStatus = (user: User) =>
    setStatus.mutate(
      { id: user.id, status: user.status === 'active' ? 'inactive' : 'active' },
      {
        onSuccess: () =>
          toast.success(
            user.status === 'active'
              ? t('users.deactivated', { name: user.name })
              : t('users.activated', { name: user.name }),
          ),
      },
    );

  const columns = useMemo<ColumnDef<User, unknown>[]>(
    () => [
      {
        id: 'name',
        meta: { label: t('users.columns.user') },
        enableHiding: false,
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('users.columns.user')} />,
        cell: ({ row: { original: u } }) => (
          <div className="flex min-w-48 items-center gap-3">
            <UserAvatar name={u.name} avatarUrl={u.avatarUrl} />
            <div className="min-w-0">
              <p className="truncate font-medium">
                {u.name}
                {u.id === currentUserId && (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">({t('users.you')})</span>
                )}
              </p>
              <p className="truncate text-xs text-muted-foreground">{u.email}</p>
            </div>
          </div>
        ),
      },
      {
        id: 'roles',
        meta: { label: t('users.columns.roles') },
        enableSorting: false,
        header: t('users.columns.roles'),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.roles.map((r) => (
              <Badge key={r.id} variant="secondary" className="font-normal">
                {r.name}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        id: 'branches',
        meta: { label: t('users.columns.branches') },
        enableSorting: false,
        header: t('users.columns.branches'),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1 text-xs">
            {row.original.branches.map((b) => (
              <Tooltip key={b.id}>
                <TooltipTrigger asChild>
                  <span className={b.isDefault ? 'font-semibold' : 'text-muted-foreground'}>{b.code}</span>
                </TooltipTrigger>
                <TooltipContent>
                  {b.name}
                  {b.isDefault && ` · ${t('users.defaultBranch')}`}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        ),
      },
      {
        id: 'status',
        meta: { label: t('users.columns.status') },
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('users.columns.status')} />,
        cell: ({ row: { original: u } }) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge tone={u.status === 'active' ? 'success' : 'neutral'}>
              {t(`users.status.${u.status}`)}
            </StatusBadge>
            {u.isLocked && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <StatusBadge tone="danger">
                      <Lock className="size-3" aria-hidden /> {t('users.locked')}
                    </StatusBadge>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {t('users.lockedUntil', { time: formatDateTime(u.lockedUntil) })}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        ),
      },
      {
        id: 'twoFactor',
        meta: { label: t('users.columns.twoFactor') },
        enableSorting: false,
        header: t('users.columns.twoFactor'),
        cell: ({ row }) =>
          row.original.twoFactorEnabled ? (
            <ShieldCheck className="size-4 text-emerald-600" aria-label={t('users.twoFactorOn')} />
          ) : (
            <span className="text-xs text-muted-foreground">{t('users.twoFactorOff')}</span>
          ),
      },
      {
        id: 'lastLoginAt',
        meta: { label: t('users.columns.lastLogin') },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('users.columns.lastLogin')} />
        ),
        cell: ({ row }) =>
          row.original.lastLoginAt ? (
            <Tooltip>
              <TooltipTrigger className="text-sm text-muted-foreground">
                {formatRelativeTime(row.original.lastLoginAt)}
              </TooltipTrigger>
              <TooltipContent>{formatDateTime(row.original.lastLoginAt)}</TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-sm text-muted-foreground">{t('users.never')}</span>
          ),
      },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        meta: { headerClassName: 'w-12', cellClassName: 'text-right' },
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row: { original: u } }) => {
          const isSelf = u.id === currentUserId;
          if (!can(['users.update', 'users.delete'])) return null;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={t('common.actionsFor', { name: u.name })}>
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <Can permission="users.update">
                  <DropdownMenuItem onSelect={() => openEdit(u.id)}>
                    <Pencil aria-hidden /> {t('common.edit')}
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={isSelf} onSelect={() => toggleStatus(u)}>
                    {u.status === 'active' ? <UserX aria-hidden /> : <UserCheck aria-hidden />}
                    {u.status === 'active' ? t('users.deactivate') : t('users.activate')}
                  </DropdownMenuItem>
                </Can>
                <Can permission="users.delete">
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={isSelf}
                    onSelect={() => setConfirm({ kind: 'delete', user: u })}
                  >
                    <Trash2 aria-hidden /> {t('common.delete')}
                  </DropdownMenuItem>
                </Can>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers are stable enough for rendering
    [t, currentUserId, can],
  );

  const runBulkStatus = async (targets: User[], status: 'active' | 'inactive') => {
    setBulkPending(true);
    const eligible = targets.filter((u) => u.id !== currentUserId && u.status !== status);
    const results = await Promise.allSettled(
      eligible.map((u) => setStatus.mutateAsync({ id: u.id, status })),
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    setBulkPending(false);
    setConfirm(null);
    if (failed) toast.error(t('users.bulkPartial', { ok: eligible.length - failed, failed }));
    else toast.success(t('users.bulkDone', { count: eligible.length }));
  };

  const statusLabel = (s: string) => t(`users.status.${s}`);

  return (
    <>
      <PageHeader
        title={t('users.title')}
        description={t('users.description')}
        breadcrumbs={[{ label: t('nav.settings') }, { label: t('users.title') }]}
        actions={
          <Can permission="users.create">
            <Button onClick={() => openEdit(null)}>
              <Plus aria-hidden /> {t('users.new')}
            </Button>
          </Can>
        }
      />

      <DataTable
        storageKey="users"
        columns={columns}
        data={users.data?.rows}
        total={users.data?.meta.total ?? 0}
        loading={users.isPending}
        fetching={users.isFetching}
        list={list}
        getRowId={(u) => u.id}
        searchPlaceholder={t('users.search')}
        filters={[
          {
            key: 'status',
            label: t('users.columns.status'),
            options: ['active', 'inactive'].map((s) => ({ value: s, label: statusLabel(s) })),
          },
          {
            key: 'roleId',
            label: t('users.columns.roles'),
            options: (roles.data?.rows ?? []).map((r) => ({ value: r.id, label: r.name })),
          },
          {
            key: 'branchId',
            label: t('users.columns.branches'),
            options: (branches.data ?? []).map((b) => ({ value: b.id, label: b.name })),
          },
        ]}
        bulkActions={
          can('users.update')
            ? (rows) => (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirm({ kind: 'bulk-status', users: rows, status: 'active' })}
                  >
                    <UserCheck aria-hidden /> {t('users.activate')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirm({ kind: 'bulk-status', users: rows, status: 'inactive' })}
                  >
                    <UserX aria-hidden /> {t('users.deactivate')}
                  </Button>
                </>
              )
            : undefined
        }
        exporter={
          can('users.export')
            ? {
                filename: 'users',
                title: t('users.title'),
                fetchAll: () => fetchAllUsers({ ...list.query, page: undefined, limit: undefined }),
                columns: [
                  { header: t('users.fields.name'), value: (u) => u.name },
                  { header: t('users.fields.email'), value: (u) => u.email },
                  { header: t('users.fields.phone'), value: (u) => u.phone },
                  { header: t('users.columns.roles'), value: (u) => u.roles.map((r) => r.name).join(', ') },
                  {
                    header: t('users.columns.branches'),
                    value: (u) => u.branches.map((b) => b.code).join(', '),
                  },
                  { header: t('users.columns.status'), value: (u) => statusLabel(u.status) },
                  {
                    header: t('users.columns.lastLogin'),
                    value: (u) => (u.lastLoginAt ? formatDateTime(u.lastLoginAt) : ''),
                  },
                ],
              }
            : undefined
        }
        empty={{
          title: t('users.emptyTitle'),
          description: t('users.emptyText'),
          action: can('users.create') ? (
            <Button onClick={() => openEdit(null)}>
              <Plus aria-hidden /> {t('users.new')}
            </Button>
          ) : undefined,
        }}
      />

      <UserFormDrawer
        open={drawer.open}
        userId={drawer.userId}
        onOpenChange={(open) => setDrawer((d) => ({ ...d, open }))}
      />

      <ConfirmDialog
        open={confirm?.kind === 'delete'}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title={t('users.deleteTitle')}
        description={confirm?.kind === 'delete' && t('users.deleteText', { name: confirm.user.name })}
        confirmLabel={t('common.delete')}
        loading={remove.isPending}
        onConfirm={() =>
          confirm?.kind === 'delete' &&
          remove.mutate(confirm.user.id, {
            onSuccess: () => {
              toast.success(t('users.deleted'));
              setConfirm(null);
            },
            onError: () => setConfirm(null),
          })
        }
      />

      <ConfirmDialog
        open={confirm?.kind === 'bulk-status'}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive={confirm?.kind === 'bulk-status' && confirm.status === 'inactive'}
        title={
          confirm?.kind === 'bulk-status' &&
          t(confirm.status === 'active' ? 'users.bulkActivateTitle' : 'users.bulkDeactivateTitle', {
            count: confirm.users.length,
          })
        }
        description={t('users.bulkSkipSelf')}
        loading={bulkPending}
        onConfirm={() => confirm?.kind === 'bulk-status' && runBulkStatus(confirm.users, confirm.status)}
      />
    </>
  );
}
