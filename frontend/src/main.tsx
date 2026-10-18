import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('MAXIMUS: root element #root not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
