import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app';
import './foundation.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('StashBase renderer root is missing');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
