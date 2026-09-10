import { contextBridge, ipcRenderer } from 'electron';

import { createBugReportReviewPreload } from './review-preload.ts';

// A separate bridge from the workspace preload: the review page cannot choose
// a draft, a window identity, a filesystem path, or a screenshot source.
contextBridge.exposeInMainWorld(
  'stashbase',
  Object.freeze({ bugReportReview: createBugReportReviewPreload(ipcRenderer) }),
);
