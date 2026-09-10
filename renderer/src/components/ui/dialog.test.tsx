import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { expectNoA11yViolations } from '@/test/axe';

import { Button } from './button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';

afterEach(cleanup);

function RemoveFolderDialog({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  return (
    <Dialog defaultOpen {...(onOpenChange ? { onOpenChange } : {})}>
      <DialogTrigger render={<Button variant="tertiary">Open dialog</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove folder?</DialogTitle>
          <DialogDescription>The source files stay on disk.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Keep folder</Button>} />
          <Button>Remove</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe('Dialog', () => {
  it('names and describes the open panel from its header', async () => {
    render(<RemoveFolderDialog />);
    const panel = await screen.findByRole('dialog', { name: 'Remove folder?' });
    expect(panel.textContent).toContain('The source files stay on disk.');
    // The panel lives in a portal, so the whole document is the subject. Base
    // UI finishes configuring the panel's focus guards a tick after the panel
    // itself mounts, and under a loaded suite a bare scan can land inside that
    // gap, where a guard is still focusable inside the inert wrapper. The scan
    // is unchanged; it is only held until the DOM has settled.
    await waitFor(() => expectNoA11yViolations(document.body));
  });

  it('closes from the close control', async () => {
    const onOpenChange = vi.fn();
    render(<RemoveFolderDialog onOpenChange={onOpenChange} />);
    await screen.findByRole('dialog', { name: 'Remove folder?' });
    fireEvent.click(screen.getByRole('button', { name: 'Keep folder' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenLastCalledWith(false));
  });
});
