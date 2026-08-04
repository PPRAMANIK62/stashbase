import { useApp } from '../store/AppContext';
import { ModalShell } from './ModalShell';

/**
 * VSCode-style confirmation when a rename or move would update
 * cross-references in other notes. Three choices:
 *
 *   - Update    — rename + rewrite every backlink (default action).
 *   - Don't     — rename but leave backlinks pointing at the old
 *                 path (they'll break; useful when the user wants
 *                 explicit cleanup later).
 *   - Cancel    — abort the whole rename, keep current state.
 *
 * Driven by `state.cascadePrompt`; the rename actions await a
 * matching `resolveCascadePrompt(decision)` call.
 */
export function CascadePromptModal() {
  const { state, actions } = useApp();
  const prompt = state.cascadePrompt;

  if (!prompt) return null;

  const fromShort = prompt.oldPath.split('/').pop() || prompt.oldPath;
  const toShort = prompt.newPath.split('/').pop() || prompt.newPath;
  const kindLabel = prompt.kind === 'folder' ? 'folder' : 'note';

  return (
    <ModalShell
      title="Update references?"
      description={
        <>
        Renaming this {kindLabel} from <strong>{fromShort}</strong> to <strong>{toShort}</strong>{' '}
        will affect {prompt.links} link{prompt.links === 1 ? '' : 's'} across{' '}
        {prompt.files} file{prompt.files === 1 ? '' : 's'}.
        </>
      }
      onCancel={() => actions.resolveCascadePrompt('cancel')}
    >
      <div className="modal-actions">
        <button
          type="button"
          className="modal-btn"
          onClick={() => actions.resolveCascadePrompt('cancel')}
        >Cancel</button>
        <button
          type="button"
          className="modal-btn"
          onClick={() => actions.resolveCascadePrompt('skip')}
        >Don't update</button>
        <button
          type="button"
          className="modal-btn primary"
          autoFocus
          onClick={() => actions.resolveCascadePrompt('update')}
        >Update</button>
      </div>
    </ModalShell>
  );
}
