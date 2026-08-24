import { Button } from '@/common/components/ui/button';
import { useAppActions } from '@/store/contexts/AppContext';
import { cn } from '@/common/lib/utils';

/**
 * Obsidian-style landing inside a blank `+` tab — three vertically-
 * stacked shortcut links centered in the document area. All wiring goes
 * through stable AppContext actions (no DOM queries here), so this
 * component is a pure render of the available actions.
 */
/**
 * The landing-specific deltas on top of `Button variant="ghost"
 * size="sm"`. The press scale, the transition, the hover tint, and the
 * 28px row are the primitive's now — this used to re-declare all four,
 * which is exactly the drift `Button` exists to prevent. What is left is
 * the shortcut hint: a `kbd` inside these rows is a quiet annotation, not
 * a keycap, so it drops the monospace face and the medium weight the row
 * label carries.
 *
 * Deltas handed to an existing component are what a class string is FOR: a
 * wrapper here would re-declare `Button`'s props to pass them straight
 * through, and the three rows already differ in ink (two accent, one
 * muted) on top of it.
 */
const ACTION_CLASS =
  'gap-2.5 text-base [&_kbd]:[font-family:inherit] [&_kbd]:text-sm [&_kbd]:font-normal [&_kbd]:tracking-wider [&_kbd]:text-muted-foreground';

export function EmptyTabLanding() {
  const { actions } = useAppActions();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 p-10">
      <Button
        variant="ghost"
        size="sm"
        className={cn(ACTION_CLASS, 'text-accent hover:text-accent')}
        onClick={() => { void actions.newNote(); }}
      >
        Create new note <kbd>⌘N</kbd>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(ACTION_CLASS, 'text-accent hover:text-accent')}
        onClick={() => { window.dispatchEvent(new Event('stashbase-open-quick-open')); }}
      >
        Open notes <kbd>⌘O</kbd>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(ACTION_CLASS, 'text-muted-foreground hover:text-foreground')}
        onClick={() => { void actions.closeActiveTab(); }}
      >
        Close tab
      </Button>
    </div>
  );
}
