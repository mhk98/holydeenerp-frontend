import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { useAuthStore } from '@/stores/auth-store';
import { EmptyState } from '@/components/common/empty-state';

/**
 * Route/element guard: renders children only when the user holds the permission
 * (or is a Super Admin when `superAdmin` is set).
 */
export function RequirePermission({
  permission,
  superAdmin,
  children,
}: {
  permission?: string | string[];
  superAdmin?: boolean;
  children: ReactNode;
}) {
  const { can } = usePermission();
  const isSuperAdmin = useAuthStore((s) => s.user?.isSuperAdmin);
  const { t } = useTranslation();
  if (superAdmin ? isSuperAdmin : can(permission)) return children;
  return (
    <EmptyState
      className="mt-10"
      icon={ShieldAlert}
      title={t('common.forbidden')}
      description={t('common.forbiddenText')}
    />
  );
}
