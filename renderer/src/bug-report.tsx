import { mountBugReportReview } from '@/app/bootstrap/bug-report-startup';

import './globals.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('StashBase bug report root is missing');
}

mountBugReportReview(root);
