import { Route, Routes } from 'react-router-dom';

import { ALL_NAV_ITEMS } from './navigation';
import { AppLayout } from '../components/layout/AppLayout';
import { AuthLayout } from '../features/auth/AuthLayout';
import { LoginPage } from '../features/auth/LoginPage';
import { ProfilePage } from '../features/auth/ProfilePage';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { PublicOnlyRoute } from '../features/auth/PublicOnlyRoute';
import { RegisterPage } from '../features/auth/RegisterPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { GoalsPage } from '../features/goals/GoalsPage';
import { OnboardingPage } from '../features/onboarding/OnboardingPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { NotFoundPage } from '../features/shared/NotFoundPage';
import { PlaceholderPage } from '../features/shared/PlaceholderPage';

const plannedItems = ALL_NAV_ITEMS.filter((item) => !item.implemented);

/**
 * Application routes.
 *
 * The authentication screens are public (and redirect signed-in users away).
 * Everything else lives behind `ProtectedRoute`, which resolves the session
 * before rendering. Planned routes render the honest "not implemented yet"
 * page generated from the navigation model, so every link in the sidebar
 * resolves to a real route and nothing is faked.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="onboarding" element={<OnboardingPage />} />
          {plannedItems.map((item) => (
            <Route
              key={item.path}
              path={item.path.replace(/^\//, '')}
              element={<PlaceholderPage item={item} />}
            />
          ))}
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
