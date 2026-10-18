import { BrowserRouter } from 'react-router-dom';

import { AuthProvider } from '../features/auth/AuthContext';
import { AppRoutes } from './routes';

/** Root application component. */
export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
