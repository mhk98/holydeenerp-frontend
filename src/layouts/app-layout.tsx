import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/settings-store';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { PageSkeleton } from '@/components/common/page-skeleton';
import { AppConfigSync } from '@/app/app-config-sync';
import { AppSidebar } from './components/app-sidebar';
import { CommandPalette } from './components/command-palette';
import {
  BranchSwitcher,
  LanguageToggle,
  NotificationsBell,
  ThemeToggle,
  UserMenu,
} from './components/topbar-controls';

export function AppLayout() {
  const { t } = useTranslation();
  const { sidebarOpen, setSidebarOpen } = useSettingsStore();

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <AppConfigSync />
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur sm:px-4">
          <SidebarTrigger className="-ml-1" aria-label={t('topbar.toggleSidebar')} />
          <Separator orientation="vertical" className="mr-1 data-vertical:h-5 data-vertical:self-center" />
          <BranchSwitcher />
          <div className="ml-auto flex items-center gap-1">
            <CommandPalette />
            <NotificationsBell />
            <LanguageToggle />
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
