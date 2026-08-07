/**
 * Auto-pops on folder open when no embedding key is on file. Without a
 * key, embedding/index updates and semantic search are disabled. Two
 * exits:
 *   • Save key — validates + persists via `/api/embedder/key`, daemon
 *     hot-swap, modal closes.
 *   • Later — dismiss; modal will re-pop next time the folder opens.
 * We deliberately don't show a plain "Cancel" — "Later" is the soft
 * escape.
 */
import { useRef, useState } from 'react';
import { api, ApiError, errorMessage, type EmbedderProvider } from '../../api';
import { ModalShell } from '../ModalShell';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { StatusMessage } from '../ui/status';

const PROVIDERS: Record<EmbedderProvider, { label: string; model: string; placeholder: string }> = {
  openai: {
    label: 'OpenAI',
    model: 'text-embedding-3-small',
    placeholder: 'sk-...',
  },
  openrouter: {
    label: 'OpenRouter',
    model: 'openai/text-embedding-3-small',
    placeholder: 'sk-or-v1-...',
  },
};

const PROVIDER_ORDER: EmbedderProvider[] = ['openai', 'openrouter'];

export function RequireApiKeyModal({
  initialProvider = 'openai',
  onSaved,
  onLater,
}: {
  initialProvider?: EmbedderProvider;
  onSaved: (provider: EmbedderProvider, model: string, backfillStarted?: boolean, warning?: string) => void;
  onLater: () => void;
}) {
  const [provider, setProvider] = useState<EmbedderProvider>(initialProvider);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function submit() {
    const k = key.trim();
    if (!k) { setError('Key required'); return; }
    setBusy(true);
    setError(null);
    try {
      // `changeApiKey` server-side rejects definite provider auth failures,
      // persists to `~/.stashbase/config.json`, and rebinds so the next
      // search uses the new key (creating the collection on first key).
      const result = await api.changeApiKey(k, provider);
      onSaved(result.provider, result.model, result.backfillStarted, result.warning);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : errorMessage(err);
      setError(msg);
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title="Add embedding key"
      description="Semantic search uses embeddings. Choose a provider, then paste the API key. Keyword search and editing work without it."
      initialFocus={inputRef}
      onCancel={busy ? () => { /* swallow */ } : onLater}
    >
      <div className="mb-2 inline-flex max-w-full items-center overflow-hidden rounded-md border border-border bg-background" role="radiogroup" aria-label="Embedding provider">
        {PROVIDER_ORDER.map((optionProvider) => {
          const option = PROVIDERS[optionProvider];
          const selected = provider === optionProvider;
          return (
            <button
              key={optionProvider}
              type="button"
              className={
                'min-h-[30px] cursor-pointer border-0 border-l border-border px-2.75 text-sm '
                + 'whitespace-nowrap text-foreground transition-colors duration-fast first:border-l-0 '
                + 'enabled:hover:bg-muted disabled:cursor-default disabled:opacity-60 '
                + (selected ? 'bg-accent/8 font-semibold' : 'bg-transparent font-medium')
              }
              role="radio"
              aria-checked={selected}
              disabled={busy}
              onClick={() => {
                setProvider(optionProvider);
                setKey('');
                setError(null);
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <div className="mb-2.5 flex flex-wrap gap-x-3 gap-y-1 text-base leading-normal text-muted-foreground [&_code]:font-mono [&_code]:text-sm [&_code]:text-accent">
        <span>Model: <code>{PROVIDERS[provider].model}</code></span>
        <span>Stored locally in <code>~/.stashbase/config.json</code></span>
      </div>
      <Input
        ref={inputRef}
        type="password"
        className="font-mono text-sm"
        placeholder={PROVIDERS[provider].placeholder}
        autoComplete="off"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        disabled={busy}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Enter') { e.preventDefault(); void submit(); }
        }}
      />
      {error && (
        <StatusMessage tone="error" className="mt-2.5 max-h-[min(180px,32vh)] overflow-y-auto wrap-anywhere">
          {error}
        </StatusMessage>
      )}
      <div className="mt-3.5 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onLater}
          disabled={busy}
        >Later</Button>
        <Button
          type="button"
          onClick={submit}
          disabled={busy}
        >{busy ? 'Validating…' : 'Save key'}</Button>
      </div>
    </ModalShell>
  );
}
