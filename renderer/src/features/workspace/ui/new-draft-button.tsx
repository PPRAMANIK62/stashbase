/** The titlebar's way into a new draft: a file with a plus, at the row's
 *  left end ahead of the tabs. It asks the tree to create `Untitled.md`
 *  beside the selection and open it for editing; a window with no folder
 *  has nowhere to put one, so the button is not offered there. */
import { FilePlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useSizeVariant } from '@/lib/size-context';

export function NewDraftButton({ onCreate }: { onCreate(): void }) {
  const size = useSizeVariant() === 'compact' ? ('icon-compact' as const) : ('icon' as const);
  return (
    <Tooltip content="New draft" side="bottom">
      <Button aria-label="New draft" onClick={onCreate} size={size} variant="ghost">
        <FilePlus aria-hidden="true" />
      </Button>
    </Tooltip>
  );
}
