import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import {
  AlarmClock,
  AlertTriangle,
  Bell,
  CalendarX2,
  Check,
  ChevronsUpDown,
  GitBranch,
  Languages,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  ClipboardCheck,
  type LucideIcon,
  PackageX,
  Truck,
  User,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { usePermission } from '@/hooks/use-permission';
import { LANGUAGES } from '@/lib/i18n';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { UserAvatar } from '@/components/common/user-avatar';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/features/auth/api/auth-api';
import { useStockAlerts } from '@/features/inventory/api/inventory-api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function BranchSwitcher() {
  const { t } = useTranslation();
  const branches = useAuthStore((s) => s.user?.branches ?? []);
  const { activeBranchId, setActiveBranch } = useSettingsStore();
  const queryClient = useQueryClient();
  const active = branches.find((b) => b.id === activeBranchId);

  // Branch-scoped data must be reloaded for the newly selected branch.
  const switchTo = (id: string | null) => {
    setActiveBranch(id);
    queryClient.invalidateQueries();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2" aria-label={t('topbar.branch')}>
          <GitBranch aria-hidden />
          <span className="hidden max-w-36 truncate md:inline">
            {active?.name ?? t('topbar.allBranches')}
          </span>
          <ChevronsUpDown className="hidden text-muted-foreground md:inline" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{t('topbar.branch')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={activeBranchId ?? 'all'}
          onValueChange={(v) => switchTo(v === 'all' ? null : v)}
        >
          <DropdownMenuRadioItem value="all">{t('topbar.allBranches')}</DropdownMenuRadioItem>
          {branches.map((b) => (
            <DropdownMenuRadioItem key={b.id} value={b.id}>
              <span className="flex-1">{b.name}</span>
              <span className="text-xs text-muted-foreground">{b.code}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type AlertKey =
  'lowStock' | 'outOfStock' | 'nearExpiry' | 'expired' | 'pendingApprovals' | 'incomingTransfers';

const ALERT_ITEMS: { key: AlertKey; icon: LucideIcon; to: string; tone: string }[] = [
  {
    key: 'expired',
    icon: CalendarX2,
    to: '/inventory/reports?report=expiry&status=expired',
    tone: 'text-red-600 dark:text-red-400',
  },
  {
    key: 'outOfStock',
    icon: PackageX,
    to: '/inventory/stock?status=out',
    tone: 'text-red-600 dark:text-red-400',
  },
  {
    key: 'nearExpiry',
    icon: AlarmClock,
    to: '/inventory/reports?report=expiry&status=near',
    tone: 'text-amber-600 dark:text-amber-400',
  },
  {
    key: 'lowStock',
    icon: AlertTriangle,
    to: '/inventory/stock?status=low',
    tone: 'text-amber-600 dark:text-amber-400',
  },
  {
    key: 'pendingApprovals',
    icon: ClipboardCheck,
    to: '/inventory/adjustments?status=pending_approval',
    tone: 'text-sky-600 dark:text-sky-400',
  },
  {
    key: 'incomingTransfers',
    icon: Truck,
    to: '/inventory/transfers?direction=incoming&status=in_transit',
    tone: 'text-sky-600 dark:text-sky-400',
  },
];

/** Bell with inventory alerts (low/out of stock, expiry) and work waiting for the user. */
export function NotificationsBell() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const enabled = can('inventory.view');
  const alerts = useStockAlerts({ limit: 1 }, { enabled, refetchInterval: 5 * 60_000 });
  const counts = alerts.data?.counts;
  // Approvals only matter to approvers.
  const items = ALERT_ITEMS.filter(
    (i) => (counts?.[i.key] ?? 0) > 0 && (i.key !== 'pendingApprovals' || can('inventory.approve')),
  );
  const total = items.reduce((n, i) => n + (counts?.[i.key] ?? 0), 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={total ? t('topbar.notificationsCount', { count: total }) : t('topbar.notifications')}
        >
          <Bell aria-hidden />
          {total > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-medium text-white">
              {total > 99 ? '99+' : total}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>{t('topbar.notifications')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
            <Bell className="size-6 opacity-40" aria-hidden />
            {t('topbar.noNotifications')}
          </div>
        ) : (
          <DropdownMenuGroup>
            {items.map(({ key, icon: Icon, to, tone }) => (
              <DropdownMenuItem key={key} asChild>
                <Link to={to} className="flex items-start gap-3 py-2">
                  <Icon className={`mt-0.5 ${tone}`} aria-hidden />
                  <span className="flex flex-col">
                    <span className="font-medium">
                      {t(`inventory.notifications.${key}`, { count: counts?.[key] ?? 0 })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t(`inventory.notifications.${key}Hint`)}
                    </span>
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LanguageToggle() {
  const { t } = useTranslation();
  const { language, setLanguage } = useSettingsStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('topbar.language')}>
          <Languages aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('topbar.language')}</DropdownMenuLabel>
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem key={lang.code} onSelect={() => setLanguage(lang.code)}>
            <span className="flex-1">{lang.label}</span>
            {language === lang.code && <Check aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('topbar.theme')}>
          <Sun className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" aria-hidden />
          <Moon
            className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
            aria-hidden
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun aria-hidden /> {t('topbar.light')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon aria-hidden /> {t('topbar.dark')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor aria-hidden /> {t('topbar.system')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UserMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={user.name}>
          <UserAvatar name={user.name} avatarUrl={user.avatarUrl} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">{user.name}</span>
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            {user.roles[0] && (
              <span className="text-xs text-muted-foreground">
                {user.roles.map((r) => r.name).join(', ')}
              </span>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link to="/profile">
              <User aria-hidden /> {t('topbar.profile')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/profile?tab=security">
              <Settings aria-hidden /> {t('topbar.accountSettings')}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={logout.isPending}
          onSelect={() =>
            logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })
          }
        >
          <LogOut aria-hidden /> {t('topbar.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
