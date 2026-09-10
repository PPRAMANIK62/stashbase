import { useStore } from 'zustand';

import type { BugReportReviewRuntime } from '@/features/bug-report/application/review-runtime';
import type { ReviewSession } from '@/features/bug-report/domain/review-session';

export function useReviewSession(runtime: BugReportReviewRuntime): ReviewSession {
  return useStore(runtime.store);
}
