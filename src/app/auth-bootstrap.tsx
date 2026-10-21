import { useEffect, type ReactNode } from 'react';
import { refreshSession } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';

/**
 * Restores the session on page load using the refresh cookie, and keeps
 * user-dependent UI settings (branch, language) consistent with the session.
 */
export function AuthBootstrap({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (useAuthStore.getState().status === 'loading') refreshSession().catch(() => {});
  }, []);

  useEffect(
    () =>
      useAuthStore.subscribe((state, prev) => {
        if (!state.user || state.user === prev.user) return;
        const settings = useSettingsStore.getState();
        // Drop a remembered branch the user no longer has access to.
        if (settings.activeBranchId && !state.user.branches.some((b) => b.id === settings.activeBranchId)) {
          settings.setActiveBranch(null);
        }
        // Apply the user's language preference when they sign in.
        if (!prev.user) settings.setLanguage(state.user.language);
      }),
    [],
  );

  return children;
}
