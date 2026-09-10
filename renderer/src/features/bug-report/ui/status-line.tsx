import { failureMessage } from '@/features/bug-report/application/failure-messages';
import type { ReviewSession } from '@/features/bug-report/domain/review-session';

import {
  LOADING_TEXT,
  noticeText,
  PREPARING_TEXT,
  readyPendingText,
  reviewingPendingText,
} from './labels';

interface Status {
  readonly message: string;
  readonly tone: 'info' | 'error';
}

function statusOf(session: ReviewSession): Status | null {
  switch (session.kind) {
    case 'loading':
      return { message: LOADING_TEXT, tone: 'info' };
    case 'unavailable':
      return { message: failureMessage(session.failure.kind), tone: 'error' };
    case 'preparing':
      return { message: PREPARING_TEXT, tone: 'info' };
    case 'reviewing': {
      const pending = reviewingPendingText(session.pending);
      if (pending) return { message: pending, tone: 'info' };
      break;
    }
    case 'ready': {
      const pending = readyPendingText(session.pending);
      if (pending) return { message: pending, tone: 'info' };
      break;
    }
    case 'closed':
      return null;
  }
  if (!session.notice) return null;
  return {
    message: noticeText(session.notice),
    tone: session.notice.kind === 'failed' ? 'error' : 'info',
  };
}

/** Both live regions stay mounted, so a change is announced rather than a
 *  region appearing already filled. */
export function StatusLine({ session }: { session: ReviewSession }) {
  const status = statusOf(session);
  return (
    <div className="min-h-5 text-caption">
      <p className="text-muted-foreground" role="status">
        {status?.tone === 'info' ? status.message : ''}
      </p>
      <p className="text-destructive" role="alert">
        {status?.tone === 'error' ? status.message : ''}
      </p>
    </div>
  );
}
