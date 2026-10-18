import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { AuthLoadingScreen } from './AuthLoadingScreen';
import { useAuth } from './AuthContext';

/**
 * Route guard for authenticated areas.
 *
 * While the session is being restored it shows a loading screen (never a
 * flash of the login page). Anonymous users are redirected to `/login`,
 * remembering where they were headed.
 */
export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <AuthLoadingScreen />;
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
