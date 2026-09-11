/**
 * Where search by meaning gets its embeddings: a key the reader brings. There
 * is no other source, so the panel is one row that either holds a key or asks
 * for one. Nothing here signs anyone in; the StashBase account belongs to the
 * Agents section and buys OpenQuill's credits, not search.
 */

import { KeyRound, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { InputField, InputGroup } from '@/components/ui/input-group';
import { TabsSubtle, TabsSubtleItem } from '@/components/ui/tabs-subtle';
import type { EmbedderPort } from '@/features/settings/application/embedder-port';
import {
  describeEmbedderSource,
  EMBEDDER_PROVIDER_LABELS,
  EMBEDDER_PROVIDERS,
  keyIsActive,
  type EmbedderProvider,
  type EmbedderState,
} from '@/features/settings/domain/embedder';
import { useEmbedder, type EmbedderViewModel } from '@/features/settings/hooks/use-embedder';
import {
  SettingsGroup,
  SettingsList,
  SettingsPane,
  SettingsRow,
  StatusChip,
} from '@/features/settings/ui/rows';
import { FailureNotice } from '@/shared/ui/failure-notice';

export interface AiIndexPanelProps {
  embedderApi: EmbedderPort;
}

function KeyRow({ embedder, state }: { embedder: EmbedderViewModel; state: EmbedderState }) {
  const [provider, setProvider] = useState<EmbedderProvider>(state.provider);
  const [key, setKey] = useState('');
  const [editing, setEditing] = useState(!state.hasKey);
  const active = keyIsActive(state);
  const busy = embedder.keyBusy;
  const label = EMBEDDER_PROVIDER_LABELS[state.provider];

  const openEditor = () => {
    setKey('');
    setEditing(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) return;
    embedder.saveKey({ key: trimmed, provider }, () => {
      setKey('');
      setEditing(false);
    });
  };

  return (
    <SettingsRow
      detail={
        state.hasKey
          ? `${label} key stored`
          : 'OpenAI or OpenRouter, billed to you. Used only for search by meaning.'
      }
      title={
        <>
          Your own API key
          {active && <StatusChip>Active</StatusChip>}
        </>
      }
      trail={
        editing ? null : state.hasKey ? (
          <>
            <Button disabled={busy} onClick={openEditor} size="compact" variant="ghost">
              Replace key
            </Button>
            <Button
              disabled={busy}
              leadingIcon={Trash2}
              onClick={() => embedder.removeKey()}
              size="compact"
              variant="ghost"
            >
              Remove key
            </Button>
          </>
        ) : (
          <Button
            disabled={busy}
            leadingIcon={KeyRound}
            onClick={openEditor}
            size="compact"
            variant="tertiary"
          >
            Add key
          </Button>
        )
      }
    >
      {editing && (
        <form className="flex max-w-[440px] flex-col items-start gap-2.5" onSubmit={submit}>
          <TabsSubtle
            aria-label="Key provider"
            onSelect={(index) => setProvider(EMBEDDER_PROVIDERS[index] ?? 'openai')}
            selectedIndex={Math.max(0, EMBEDDER_PROVIDERS.indexOf(provider))}
            size="compact"
          >
            {EMBEDDER_PROVIDERS.map((candidate) => (
              <TabsSubtleItem key={candidate} label={EMBEDDER_PROVIDER_LABELS[candidate]} />
            ))}
          </TabsSubtle>
          <InputGroup className="w-full" size="compact">
            <InputField
              autoComplete="off"
              filled
              label={`${EMBEDDER_PROVIDER_LABELS[provider]} API key`}
              onChange={setKey}
              placeholder="Paste the key"
              spellCheck={false}
              type="password"
              value={key}
            />
          </InputGroup>
          <div className="flex items-center gap-1">
            <Button
              disabled={busy || key.trim().length === 0}
              loading={embedder.savingKey}
              size="compact"
              type="submit"
              variant="secondary"
            >
              Save key
            </Button>
            {state.hasKey && (
              <Button
                disabled={busy}
                onClick={() => setEditing(false)}
                size="compact"
                variant="ghost"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}
      {embedder.keyWarning && (
        <p className="mt-1.5 text-caption text-muted-foreground" role="status">
          Saved, but the key could not be verified yet: {embedder.keyWarning}
        </p>
      )}
      {embedder.keyFailure && <FailureNotice className="mt-1.5" failure={embedder.keyFailure} />}
    </SettingsRow>
  );
}

export function AiIndexPanel({ embedderApi }: AiIndexPanelProps) {
  const embedder = useEmbedder(embedderApi);
  const state = embedder.state;

  if (embedder.loading) {
    return (
      <p className="text-caption text-muted-foreground" role="status">
        Loading settings for search by meaning…
      </p>
    );
  }
  if (!state) {
    return (
      <div className="flex items-center justify-between gap-2">
        <p className="text-caption text-destructive" role="alert">
          Settings for search by meaning are unavailable.
        </p>
        <Button onClick={() => embedder.reload()} size="compact" variant="tertiary">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <SettingsPane
      lede="Search by meaning finds files even when the wording differs. It is off until you add an embedding key here. Keyword search and every local workflow work without it."
      title="Search by Meaning"
    >
      <SettingsGroup hint={describeEmbedderSource(state)} title="Embedding key">
        <SettingsList>
          <KeyRow embedder={embedder} state={state} />
        </SettingsList>
      </SettingsGroup>
    </SettingsPane>
  );
}
