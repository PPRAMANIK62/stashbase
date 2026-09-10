/**
 * The boundary around the window's composition, and the only place its
 * sentences live. There is no `app/application/failure-messages.ts`, because
 * `app/` composes features rather than owning a capability of its own;
 * `./bootstrap/startup-failure.tsx` sets the same precedent for the other
 * failure a window can reach the reader with.
 *
 * The detail sentence is careful because the guarantee behind it is narrow.
 * Snapshots of unsaved text are journaled outside React, over HTTP to the
 * local server, which seals them to disk, so they do survive the subtree
 * remount this boundary performs. The dirty buffer itself does not survive,
 * because the tabs runtime lives in `useState` and is disposed with the
 * subtree along with everything it held. Snapshots are also deliberately
 * behind the typist, written 1.5s after the last keystroke and at worst every
 * 5s through continuous typing, so the newest text was never journaled. And on
 * an installation where Electron's `safeStorage` is unavailable the journal is
 * disabled outright, which is why the sentence says StashBase recovers what it
 * could store rather than promising recovery.
 */
import type { ReactNode } from 'react';

import { SurfaceBoundary } from '@/shared/runtime/surface-boundary';

const SHELL_RECOVERY = {
  actions: [{ label: 'Reopen the workspace' }],
  detail:
    'Reopening reloads this folder from disk. Unsaved text comes back from draft recovery where StashBase could store it, and never includes the last few seconds of typing.',
  message: 'The workspace could not be drawn.',
} as const;

export function ShellBoundary({ children }: { children: ReactNode }) {
  return (
    <SurfaceBoundary placement="window" recovery={SHELL_RECOVERY} surface="workspace">
      {children}
    </SurfaceBoundary>
  );
}
