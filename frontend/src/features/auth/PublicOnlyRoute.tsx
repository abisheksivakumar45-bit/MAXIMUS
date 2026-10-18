import { Navigate, Outlet } from 'react-router-dom';

import { AuthLoadingScreen } from './AuthLoadingScreen';
import { useAuth } from './AuthContext';

/**
 * Route guard for the authentication screens.
 *
 * Users who are already signed in are sent to the dashboard so they do not
 * see the login/registration forms.
 */
export function PublicOnlyRoute() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <AuthLoadingScreen />;
  }

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
