import { Suspense } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { usePermission } from '@/hooks/use-permission';
import { useAuthStore } from '@/stores/auth-store';
import { PageSkeleton } from '@/components/common/page-skeleton';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SETTINGS_NAV } from '../settings-nav';

/** Settings area: grouped tab navigation on the left (a picker on small screens). */
export function SettingsLayout() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const isSuperAdmin = useAuthStore((s) => s.user?.isSuperAdmin);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const groups = SETTINGS_NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => (i.superAdminOnly ? isSuperAdmin : can(i.permission))),
  })).filter((g) => g.items.length);

  const current = pathname.split('/')[2] ?? '';

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <nav aria-label={t('nav.settings')} className="lg:w-56 lg:shrink-0">
        {/* Small screens: section picker */}
        <div className="lg:hidden">
          <Select value={current} onValueChange={(v) => navigate(`/settings/${v}`)}>
            <SelectTrigger className="w-full" aria-label={t('nav.settings')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectGroup key={g.key}>
                  <SelectLabel>{t(`settings.groups.${g.key}`)}</SelectLabel>
                  {g.items.map((i) => (
                    <SelectItem key={i.key} value={i.key}>
                      {t(`settings.nav.${i.key}`)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Large screens: grouped vertical tabs */}
        <div className="sticky top-20 hidden space-y-5 lg:block">
          {groups.map((g) => (
            <div key={g.key}>
              <p className="mb-1.5 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t(`settings.groups.${g.key}`)}
              </p>
              <ul className="space-y-0.5">
                {g.items.map((i) => (
                  <li key={i.key}>
                    <NavLink
                      to={`/settings/${i.key}`}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isActive
                            ? 'bg-muted font-medium text-foreground'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                        )
                      }
                    >
                      <i.icon className="size-4" aria-hidden />
                      {t(`settings.nav.${i.key}`)}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className="min-w-0 flex-1">
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
