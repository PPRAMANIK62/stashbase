/**
 * The boundary around the window's composition, and the only place its
 * sentences live. There is no `app/application/failure-messages.ts`, because
 * `app/` composes features rather than owning a capability of its own;
 * `./bootstrap/startup-failure.tsx` sets the same precedent for the other
 * failure a window can reach the reader with.
 *
 * Remounting disposes the document runtimes and their unsaved buffers.
 * Only text already saved to source files survives; there is no draft journal.
 */
import type { ReactNode } from 'react';

import { SurfaceBoundary } from '@/shared/runtime/surface-boundary';

const SHELL_RECOVERY = {
  actions: [{ label: 'Reopen the workspace' }],
  detail: 'Reopening reloads this folder from disk. Text that has not been saved will be lost.',
  message: 'The workspace could not be drawn.',
} as const;

export function ShellBoundary({ children }: { children: ReactNode }) {
  return (
    <SurfaceBoundary placement="window" recovery={SHELL_RECOVERY} surface="workspace">
      {children}
    </SurfaceBoundary>
  );
}
