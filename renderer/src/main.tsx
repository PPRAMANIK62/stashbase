import { createRoot } from 'react-dom/client';

import { createDependencies } from '@/app/dependencies';
import { Providers } from '@/app/providers';
import { App } from '@/app/shell';

import './globals.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('StashBase renderer root is missing');
}

const dependencies = createDependencies();

createRoot(root).render(
  <Providers>
    <App dependencies={dependencies} />
  </Providers>,
);
