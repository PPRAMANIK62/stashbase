import { mountApplication } from '@/app/bootstrap/startup';
import { createDependencies } from '@/app/dependencies';

import './globals.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('StashBase renderer root is missing');
}

mountApplication(root, createDependencies);
