/**
 * Sidebar embedder picker — the chip + dropdown that lets the user
 * switch the current space between Local (ONNX) and OpenAI, and rotate
 * or remove the global OpenAI key.
 *
 * Four supporting modals live under `embedder/`:
 *   - `ConfirmSwitchModal` — cost estimate + "are you sure" before the
 *     provider swap fires (always shown first; switching providers
 *     wipes the space's Milvus collection).
 *   - `KeyModal` — collects an OpenAI key (validated before save).
 *   - `RequireApiKeyModal` — pops on space load when the space wants
 *     OpenAI but no key is on file. Forces an explicit choice.
 *   - `RemoveKeyModal` — confirms removal of the global key.
 *
 * State is local: this is the only component that cares about the
 * embedder, so threading through AppContext would be premature.
 */
import { useEffect, useState } from 'react';
import {
  api,
  type EmbedderProvider,
  type EmbedderState,
} from '../api';
import { CheckIcon, ChevronDownIcon } from '../icons';
import { useApp } from '../store/AppContext';
import { LABEL, DETAIL } from './embedder/labels';
import { KeyModal } from './embedder/KeyModal';
import { RequireApiKeyModal } from './embedder/RequireApiKeyModal';
import { RemoveKeyModal } from './embedder/RemoveKeyModal';
import { ConfirmSwitchModal, type ConfirmDraft } from './embedder/ConfirmSwitchModal';

export function EmbedderControl() {
  // Re-fetch whenever the current space changes — provider is per-space
  // now, so the chip label belongs to whatever space the user just
  // opened. `space` is the friendly name; when it flips, the server's
  // notion of "current" has already advanced.
  const { state: appState } = useApp();
  const space = appState.space;
  const [state, setState] = useState<EmbedderState | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [keyModalFor, setKeyModalFor] = useState<EmbedderProvider | null>(null);
  const [keyEditOpen, setKeyEditOpen] = useState(false);
  const [keyRemoveOpen, setKeyRemoveOpen] = useState(false);
  const [confirmDraft, setConfirmDraft] = useState<ConfirmDraft | null>(null);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  // "Provider is OpenAI, but no key on file." → pop the require-key
  // modal on space load. Reset on each space change so it pops again
  // for the next space if the user dismissed it last time.
  const [requireKeyOpen, setRequireKeyOpen] = useState(false);

  useEffect(() => {
    if (!space) { setState(null); setRequireKeyOpen(false); return; }
    let cancelled = false;
    api.getEmbedder()
      .then((s) => {
        if (cancelled) return;
        setState(s);
        // Default is OpenAI now (server-side `lockInSpaceProvider`).
        // First-time users land here with no key — block with a modal
        // so they consciously pick between "add key" and "use Local".
        setRequireKeyOpen(s.provider === 'openai' && !s.hasKey);
      })
      .catch(() => { /* startup race with server boot — silent */ });
    return () => { cancelled = true; };
  }, [space]);

  function onPick(next: EmbedderProvider) {
    setMenuOpen(false);
    if (!state || next === state.provider) return;
    // Always start with the cost confirmation — committing to spend is
    // the bigger decision; the key (if missing) is asked for *after*
    // the user has accepted the cost. Bailing out earlier means no key
    // ever lands in `~/.stashbase/config.json`.
    setConfirmDraft({ provider: next });
  }

  async function commitSwitch(provider: EmbedderProvider, openaiKey?: string) {
    setSwitching(true);
    setSwitchError(null);
    try {
      const next = await api.setEmbedder(provider, openaiKey);
      setState({ provider: next.provider, hasKey: next.hasKey });
      return true;
    } catch (err: unknown) {
      // Inline the message into the modal (or re-open one if both are
      // gone), so the failure doesn't escape into a native dialog.
      const msg = err instanceof Error ? err.message : String(err);
      setSwitchError(msg);
      return false;
    } finally {
      setSwitching(false);
    }
  }

  async function onConfirm() {
    if (!confirmDraft || !state) return;
    // OpenAI without a stored key — collect the key NOW (after the user
    // accepted the cost). Hand off to the key modal; that flow calls
    // back into `commitSwitch` once a valid key is in hand.
    if (
      confirmDraft.provider === 'openai'
      && !state.hasKey
      && !confirmDraft.openaiKey
    ) {
      setConfirmDraft(null);
      setKeyModalFor('openai');
      return;
    }
    const ok = await commitSwitch(confirmDraft.provider, confirmDraft.openaiKey);
    // Keep the modal open on failure so the inline error is visible
    // and the user can retry; close it only on success.
    if (ok) setConfirmDraft(null);
  }

  async function onKeySaved(key: string) {
    setKeyModalFor(null);
    // Cost already accepted in the prior step; go straight to the
    // actual provider switch with the freshly-validated key. On
    // failure we re-open the cost modal so the error has somewhere
    // to render (both modals are closed at this point otherwise).
    const ok = await commitSwitch('openai', key);
    if (!ok) setConfirmDraft({ provider: 'openai', openaiKey: key });
  }

  async function onKeyChanged(key: string) {
    // Validation + persistence happens server-side via PUT
    // /api/embedder/key. The KeyModal already did a client-side
    // validate before calling us, so this call only re-validates
    // server-side and persists. Same dim, no re-embed.
    await api.changeApiKey(key);
    setKeyEditOpen(false);
    setState((s) => (s ? { ...s, hasKey: true } : s));
  }

  async function onKeyRemoveConfirmed() {
    await api.removeApiKey();
    setKeyRemoveOpen(false);
    setState((s) => (s ? { ...s, hasKey: false } : s));
  }

  if (!state) return null;

  return (
    <>
      <div className="embedder-control">
        <button
          className="embedder-picker"
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          title={`Embedding provider: ${DETAIL[state.provider]}\nSwitching re-embeds this space.`}
        >
          <span className="embedder-prefix">Embedding:</span>
          <span className="embedder-label">{LABEL[state.provider]}</span>
          <ChevronDownIcon className="embedder-chev" />
        </button>
        {menuOpen && (
          <>
            <div className="embedder-backdrop" onClick={() => setMenuOpen(false)} />
            <div className="embedder-menu" role="menu">
              {(['onnx', 'openai'] as EmbedderProvider[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={'embedder-menu-item' + (p === state.provider ? ' current' : '')}
                  onClick={() => onPick(p)}
                >
                  <span className="embedder-menu-text">
                    <span className="embedder-menu-name">{LABEL[p]}</span>
                    <span className="embedder-menu-detail">{DETAIL[p]}</span>
                  </span>
                  {p === state.provider && <CheckIcon className="embedder-menu-check" />}
                </button>
              ))}
              {state.hasKey && (
                <>
                  <button
                    type="button"
                    className="embedder-menu-item embedder-menu-action"
                    onClick={() => { setMenuOpen(false); setKeyEditOpen(true); }}
                  >Change API key…</button>
                  <button
                    type="button"
                    className="embedder-menu-item embedder-menu-action danger"
                    onClick={() => { setMenuOpen(false); setKeyRemoveOpen(true); }}
                  >Remove API key…</button>
                </>
              )}
            </div>
          </>
        )}
      </div>
      {keyModalFor && (
        <KeyModal
          onCancel={() => setKeyModalFor(null)}
          onSaved={onKeySaved}
        />
      )}
      {keyEditOpen && (
        <KeyModal
          mode="change"
          onCancel={() => setKeyEditOpen(false)}
          onSaved={onKeyChanged}
        />
      )}
      {keyRemoveOpen && (
        <RemoveKeyModal
          onCancel={() => setKeyRemoveOpen(false)}
          onConfirm={onKeyRemoveConfirmed}
        />
      )}
      {confirmDraft && (
        <ConfirmSwitchModal
          draft={confirmDraft}
          switching={switching}
          error={switchError}
          onCancel={() => {
            if (switching) return;
            setConfirmDraft(null);
            setSwitchError(null);
          }}
          onConfirm={onConfirm}
        />
      )}
      {requireKeyOpen && state?.provider === 'openai' && !state.hasKey && (
        <RequireApiKeyModal
          switching={switching}
          onSaved={() => {
            // Key validated + persisted + daemon hot-swapped by the
            // PUT /api/embedder/key path inside the modal. Refresh
            // local state so the chip flips OpenAI / hasKey:true.
            setState((s) => (s ? { ...s, hasKey: true } : s));
            setRequireKeyOpen(false);
          }}
          onUseLocal={async () => {
            // Persist onnx for this space + drop+re-sync. `commitSwitch`
            // handles the dim wipe + re-bind; on success state updates.
            const ok = await commitSwitch('onnx');
            if (ok) setRequireKeyOpen(false);
          }}
          onLater={() => setRequireKeyOpen(false)}
        />
      )}
    </>
  );
}
