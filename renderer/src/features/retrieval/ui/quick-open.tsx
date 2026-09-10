import { QUICK_OPEN_FAILED } from '@/features/retrieval/application/failure-messages';
import { lazySurface } from '@/shared/runtime/lazy-surface';
import { SurfaceBoundary } from '@/shared/runtime/surface-boundary';

import type { QuickOpenProps } from './quick-open-types';

/** The palette is a whole search index and its result list; nothing is fetched
 *  until the shortcut actually opens it. Its recovery covers the window rather
 *  than filling a pane, because a modal owns no region to fall back into, and
 *  it offers Close as well as Retry so a reader whose retry keeps failing is
 *  not left standing in front of the workspace they wanted. */
export const QuickOpen = lazySurface<QuickOpenProps>(() => import('./managed-quick-open'), {
  boundary: (retry, children, props) => (
    <SurfaceBoundary
      placement="overlay"
      recovery={{
        actions: [
          { label: 'Retry', perform: retry },
          { label: 'Close', perform: props.onClose },
        ],
        message: QUICK_OPEN_FAILED,
      }}
      surface="Quick Open"
    >
      {children}
    </SurfaceBoundary>
  ),
  when: (props) => props.open,
});
