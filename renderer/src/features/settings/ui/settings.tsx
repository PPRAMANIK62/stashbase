import { lazySurface } from '@/lib/runtime/lazy-surface';

import type { SettingsProps } from './settings-types';

/** Settings is a modal a session may never open, so its panels stay out of the
 *  first paint until one is asked for. */
export const Settings = lazySurface<SettingsProps>(() => import('./managed-settings'), {
  when: (props) => props.open,
});
