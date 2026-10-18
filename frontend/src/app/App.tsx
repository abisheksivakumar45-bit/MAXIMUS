import { BrowserRouter } from 'react-router-dom';

import { AppRoutes } from './routes';

/** Root application component. */
export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
