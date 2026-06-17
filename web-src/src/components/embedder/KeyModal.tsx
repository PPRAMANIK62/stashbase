/**
 * OpenAI key entry modal. The caller persists through `/api/embedder/key`,
 * which validates against /v1/models before writing config. `mode='change'`
 * only swaps the title + button text.
 */
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../api';
import { ModalShell } from '../ModalShell';

export function KeyModal({
  mode = 'enter',
  onCancel,
  onSaved,
}: {
  mode?: 'enter' | 'change';
  onCancel: () => void;
  onSaved: (key: string) => void | Promise<void>;
}) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  async function submit() {
    const trimmed = key.trim();
    if (!trimmed) { setError('Key required'); return; }
    setBusy(true);
    setError(null);
    try {
      // The caller saves via changeApiKey, whose server route validates
      // before persisting; don't preflight here or successful saves pay
      // for two OpenAI validation calls.
      await onSaved(trimmed);
    } catch (err: unknown) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <ModalShell onCancel={onCancel}>
      <h3>{mode === 'change' ? 'Change API key' : 'OpenAI API key'}</h3>
      <p className="modal-hint">
        {mode === 'change'
          ? 'Replaces your OpenAI key. The embedder is unchanged, so the existing index stays valid — no re-indexing.'
          : 'Used only for embeddings — never for chat or completions.'}
      </p>
      <input
        ref={inputRef}
        type="password"
        className="modal-input"
        placeholder="sk-…"
        autoComplete="off"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); void submit(); }
          else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        }}
      />
      {error && <div className="modal-error">{error}</div>}
      <div className="modal-actions">
        <button type="button" className="modal-btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="modal-btn primary"
          onClick={submit}
          disabled={busy}
        >{busy ? 'Validating…' : (mode === 'change' ? 'Save' : 'Continue')}</button>
      </div>
    </ModalShell>
  );
}
