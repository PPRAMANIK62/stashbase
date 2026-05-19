/**
 * Auto-pops on space open when the space wants OpenAI (the default
 * embedder) but no global key is on file. Three exits:
 *   • Save key — validates + persists via `/api/embedder/key`, daemon
 *     hot-swap, modal closes.
 *   • Use Local instead — switches THIS space to onnx via the normal
 *     `commitSwitch` path (key never asked for again on this space).
 *   • Later — dismiss; modal will re-pop next time the space opens.
 * We deliberately don't show a plain "Cancel" — the user is being
 * asked to choose. "Later" is the soft escape.
 */
import { useEffect, useRef, useState } from 'react';
import { api, ApiError, errorMessage } from '../../api';
import { ModalShell } from '../ModalShell';

export function RequireApiKeyModal({
  switching,
  onSaved,
  onUseLocal,
  onLater,
}: {
  switching: boolean;
  onSaved: () => void;
  onUseLocal: () => void | Promise<void>;
  onLater: () => void;
}) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  async function submit() {
    const k = key.trim();
    if (!k) { setError('Key required'); return; }
    setBusy(true);
    setError(null);
    try {
      // `changeApiKey` server-side validates against OpenAI /v1/models,
      // persists to `~/.stashbase/config.json`, and (since this space is
      // openai-configured) hot-swaps the daemon's embedder so the next
      // search uses the new key without any re-embed.
      await api.changeApiKey(k);
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : errorMessage(err);
      setError(msg);
      setBusy(false);
    }
  }

  const blocked = busy || switching;

  return (
    <ModalShell onCancel={blocked ? () => { /* swallow */ } : onLater}>
      <h3>Add OpenAI key</h3>
      <p className="modal-hint">
        StashBase uses <strong>OpenAI embedding</strong> (text-embedding-3-small)
        for semantic search by default — better multilingual recall and
        cross-domain relevance than the local ONNX model, typically a few
        cents per month for a few MB of notes. The key is used only for
        embedding — no chat or completion requests are sent. Stored in
        <code> ~/.stashbase/config.json</code> (owner-only).
      </p>
      <input
        ref={inputRef}
        type="password"
        className="modal-input"
        placeholder="sk-…"
        autoComplete="off"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        disabled={blocked}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Enter') { e.preventDefault(); void submit(); }
          else if (e.key === 'Escape' && !blocked) { e.preventDefault(); onLater(); }
        }}
      />
      {error && <div className="modal-error">{error}</div>}
      <div className="modal-actions">
        <button
          type="button"
          className="modal-btn"
          onClick={() => { void onUseLocal(); }}
          disabled={blocked}
          title="Switch this space to local ONNX. Quality is lower but no API key needed."
        >{switching ? 'Switching…' : 'Use Local instead'}</button>
        <button
          type="button"
          className="modal-btn"
          onClick={onLater}
          disabled={blocked}
        >Later</button>
        <button
          type="button"
          className="modal-btn primary"
          onClick={submit}
          disabled={blocked}
        >{busy ? 'Validating…' : 'Save key'}</button>
      </div>
    </ModalShell>
  );
}
