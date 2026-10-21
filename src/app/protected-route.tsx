import { Suspense } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { FullScreenLoader } from '@/components/common/full-screen-loader';
import { RequirePermission } from './require-permission';

/** Lazy route chunks below these guards need a Suspense boundary of their own. */
const LazyOutlet = () => (
  <Suspense fallback={<FullScreenLoader />}>
    <Outlet />
  </Suspense>
);

/**
 * Gate for signed-in areas. Waits for the initial silent refresh, sends guests to
 * /login (remembering where they were going) and optionally checks a permission.
 */
export function ProtectedRoute({ permission }: { permission?: string | string[] }) {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'guest') {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return permission ? (
    <RequirePermission permission={permission}>
      <LazyOutlet />
    </RequirePermission>
  ) : (
    <LazyOutlet />
  );
}

/** Login / forgot / reset pages: signed-in users go straight to the app. */
export function GuestRoute() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'authenticated') return <Navigate to={from} replace />;
  return <LazyOutlet />;
}
