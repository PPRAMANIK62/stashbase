/** The window's notice strip: what happened to the reader's work, then the
 *  one-time sign-in banner. The banner reads the window's account, so the
 *  strip renders inside the AccountProvider rather than in the shell's hooks. */
import type { WorkspaceNotice } from '@/app/composition/folder/use-workspace-notices';
import { useAccountOffers } from '@/features/settings/public';

import { WorkspaceNotices } from './workspace-notices';

export function WorkspaceNoticeStrip({ notices }: { notices: readonly WorkspaceNotice[] }) {
  const offers = useAccountOffers();
  return <WorkspaceNotices notices={[...notices, ...offers]} />;
}
