import { useApp } from '../store/AppContext';

/**
 * Obsidian-style landing inside a blank `+` tab — three vertically-
 * stacked shortcut links centered in the document area. All wiring goes
 * through stable AppContext actions (no DOM queries here), so this
 * component is a pure render of the available actions.
 */
export function EmptyTabLanding() {
  const { actions } = useApp();
  return (
    <div className="empty-tab-landing">
      <button
        type="button"
        className="empty-tab-action"
        onClick={() => { void actions.newNote(); }}
      >
        Create new note <kbd>⌘N</kbd>
      </button>
      <button
        type="button"
        className="empty-tab-action"
        onClick={() => { actions.focusSearch(); }}
      >
        Search notes <kbd>⌘O</kbd>
      </button>
      <button
        type="button"
        className="empty-tab-action subtle"
        onClick={() => { void actions.closeActiveTab(); }}
      >
        Close tab
      </button>
    </div>
  );
}
