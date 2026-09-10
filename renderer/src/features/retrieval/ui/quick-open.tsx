import { lazySurface } from '@/shared/runtime/lazy-surface';

import type { QuickOpenProps } from './quick-open-types';

/** The palette is a whole search index and its result list; nothing is fetched
 *  until the shortcut actually opens it. */
export const QuickOpen = lazySurface<QuickOpenProps>(() => import('./managed-quick-open'), {
  when: (props) => props.open,
});
