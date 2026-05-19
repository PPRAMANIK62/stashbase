/**
 * Confirmation for removing the global OpenAI key. Spaces still
 * configured as `openai` keep their per-space config but their
 * embed / search calls will start failing until the user either
 * adds a key back or switches each space to Local.
 */
import { useState } from 'react';
import { errorMessage } from '../../api';
import { ModalShell } from '../ModalShell';

export function RemoveKeyModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err: unknown) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <ModalShell onCancel={onCancel}>
      <h3>Remove API key?</h3>
      <p className="modal-hint">
        Spaces still set to OpenAI will fail to embed / search until you
        add a key back or switch them to Local. Existing vectors are
        kept as-is.
      </p>
      {error && <div className="modal-error">{error}</div>}
      <div className="modal-actions">
        <button type="button" className="modal-btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="modal-btn primary danger"
          onClick={submit}
          disabled={busy}
        >{busy ? 'Removing…' : 'Remove key'}</button>
      </div>
    </ModalShell>
  );
}
