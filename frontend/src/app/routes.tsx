import { Route, Routes } from 'react-router-dom';

import { ALL_NAV_ITEMS } from './navigation';
import { AppLayout } from '../components/layout/AppLayout';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { NotFoundPage } from '../features/shared/NotFoundPage';
import { PlaceholderPage } from '../features/shared/PlaceholderPage';

const plannedItems = ALL_NAV_ITEMS.filter((item) => !item.implemented);

/**
 * Application routes.
 *
 * Implemented routes render real pages. Planned routes render the honest
 * "not implemented yet" page generated from the navigation model, so every
 * link in the sidebar resolves to a real route and nothing is faked.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
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
    </Routes>
  );
}
