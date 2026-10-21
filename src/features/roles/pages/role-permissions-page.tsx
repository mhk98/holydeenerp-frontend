import { useEffect, useMemo, useState } from 'react';
import { Link, useBlocker, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, Info, Pencil, RotateCcw, Save } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatNumber } from '@/lib/format';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { usePermissionCatalog, useRole, useSaveRolePermissions } from '../api/roles-api';
import { PermissionMatrix } from '../components/permission-matrix';
import { RoleFormDialog } from '../components/role-form-dialog';

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((k) => b.has(k));

export default function RolePermissionsPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const { can } = usePermission();
  const role = useRole(id);
  const catalog = usePermissionCatalog();
  const save = useSaveRolePermissions(id);
  const [renameOpen, setRenameOpen] = useState(false);

  const saved = useMemo(() => new Set(role.data?.permissionKeys ?? []), [role.data]);
  const [selected, setSelected] = useState<Set<string>>(saved);
  // Reset the working copy whenever the saved permissions change (load / after save).
  const [syncedWith, setSyncedWith] = useState(saved);
  if (syncedWith !== saved) {
    setSyncedWith(saved);
    setSelected(saved);
  }

  const readOnly = Boolean(role.data?.isSystem) || !can('users.update');
  const dirty = !readOnly && !sameSet(selected, saved);

  // Warn before leaving with unsaved changes (in-app navigation and tab close).
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const onSave = () =>
    save.mutate([...selected], {
      onSuccess: () => toast.success(t('roles.permissionsSaved')),
    });

  if (role.isError) {
    return (
      <EmptyState
        className="mt-10"
        title={t('roles.notFound')}
        action={
          <Button asChild variant="outline">
            <Link to="/settings/roles">{t('roles.backToRoles')}</Link>
          </Button>
        }
      />
    );
  }

  const loading = role.isPending || catalog.isPending;

  return (
    <>
      <PageHeader
        title={role.data?.name ?? t('roles.title')}
        description={role.data?.description ?? t('roles.matrixDescription')}
        breadcrumbs={[
          { label: t('nav.settings') },
          { label: t('roles.title'), to: '/settings/roles' },
          { label: role.data?.name ?? '…' },
        ]}
        actions={
          <>
            <Button asChild variant="ghost">
              <Link to="/settings/roles">
                <ArrowLeft aria-hidden /> {t('roles.backToRoles')}
              </Link>
            </Button>
            {!readOnly && role.data && (
              <>
                <Button variant="outline" onClick={() => setRenameOpen(true)}>
                  <Pencil aria-hidden /> {t('roles.rename')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelected(saved)}
                  disabled={!dirty || save.isPending}
                >
                  <RotateCcw aria-hidden /> {t('common.reset')}
                </Button>
                <Button onClick={onSave} disabled={!dirty || save.isPending}>
                  {save.isPending ? <Spinner /> : <Save aria-hidden />}
                  {t('common.saveChanges')}
                </Button>
              </>
            )}
          </>
        }
      />

      {role.data?.isSuperAdmin && (
        <Alert className="mb-4">
          <Info aria-hidden />
          <AlertTitle>{t('roles.superAdminTitle')}</AlertTitle>
          <AlertDescription>{t('roles.superAdminText')}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Skeleton className="h-[560px] rounded-lg" />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
            {t('roles.selectedCount', {
              count: selected.size,
              selected: formatNumber(selected.size),
              total: formatNumber(catalog.data!.permissions.length),
            })}
            {dirty && <span className="ml-2 font-medium text-amber-600">· {t('roles.unsaved')}</span>}
          </p>
          <PermissionMatrix
            catalog={catalog.data!}
            value={selected}
            onChange={setSelected}
            readOnly={readOnly}
          />
        </>
      )}

      <RoleFormDialog open={renameOpen} onOpenChange={setRenameOpen} role={role.data} />

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(o) => !o && blocker.reset?.()}
        title={t('roles.leaveTitle')}
        description={t('roles.leaveText')}
        confirmLabel={t('roles.discard')}
        destructive
        onConfirm={() => blocker.proceed?.()}
      />
    </>
  );
}
