/**
 * Where search by meaning gets its embeddings: the hosted StashBase account, or a
 * key the reader brings themselves. The two are one radio group because only
 * one can be authorized at a time, and each row carries the controls that
 * belong to its own source so no dialog is needed to change either.
 */

import { KeyRound, LogIn, LogOut, RefreshCw, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { InputField, InputGroup } from '@/components/ui/input-group';
import { TabsSubtle, TabsSubtleItem } from '@/components/ui/tabs-subtle';
import type { EmbedderPort } from '@/features/settings/application/embedder-port';
import {
  ACCOUNT_SOURCE,
  activeEmbeddingSource,
  describeEmbedderSource,
  describeQuota,
  EMBEDDER_PROVIDER_LABELS,
  EMBEDDER_PROVIDERS,
  quotaRemainingPercent,
  type EmbedderProvider,
  type EmbedderState,
} from '@/features/settings/domain/embedder';
import { useEmbedder, type EmbedderViewModel } from '@/features/settings/hooks/use-embedder';
import { FailureNotice } from '@/features/settings/ui/failure-notice';
import {
  ChoiceList,
  ChoiceRow,
  ProgressBar,
  SettingsGroup,
  SettingsPane,
  StatusChip,
} from '@/features/settings/ui/rows';

export interface AiIndexPanelProps {
  embedderApi: EmbedderPort;
  onOpenExternal(href: string): void;
}

function AccountRow({ embedder, state }: { embedder: EmbedderViewModel; state: EmbedderState }) {
  const account = state.account;
  const active = activeEmbeddingSource(state) === ACCOUNT_SOURCE;
  const busy = embedder.accountBusy;

  const select = () => {
    if (busy) return;
    if (!account.signedIn) embedder.signIn();
    else if (!active) embedder.useAccount();
  };

  return (
    <ChoiceRow
      checked={active}
      detail={
        account.signedIn ? (
          <>
            <span>{account.displayName ?? 'StashBase account'}</span>
            {account.email && (
              <>
                {' · '}
                <span>{account.email}</span>
              </>
            )}
          </>
        ) : (
          'Hosted search by meaning with monthly included credits.'
        )
      }
      firstTabStop
      label="StashBase account"
      onSelect={select}
      title={
        <>
          StashBase account
          {active && <StatusChip>Active</StatusChip>}
        </>
      }
      trail={
        account.signedIn ? (
          <Button
            disabled={busy}
            leadingIcon={LogOut}
            onClick={() => embedder.signOut()}
            size="compact"
            variant="ghost"
          >
            Sign out
          </Button>
        ) : (
          <Button
            disabled={busy}
            leadingIcon={LogIn}
            loading={embedder.signInPending}
            onClick={() => embedder.signIn()}
            size="compact"
            variant="secondary"
          >
            {embedder.signInPending ? 'Waiting for browser…' : 'Sign in to StashBase'}
          </Button>
        )
      }
      value={ACCOUNT_SOURCE}
    >
      {account.signedIn && (
        <>
          <ProgressBar value={quotaRemainingPercent(account)} />
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <p className="text-caption text-muted-foreground" role="status">
              {describeQuota(account)}
            </p>
            <Button
              disabled={busy}
              leadingIcon={RefreshCw}
              onClick={() => embedder.refreshAccount()}
              size="compact"
              variant="ghost"
            >
              Refresh usage
            </Button>
          </div>
        </>
      )}
      {embedder.accountFailure && (
        <FailureNotice className="mt-1.5" failure={embedder.accountFailure} />
      )}
    </ChoiceRow>
  );
}

function KeyRow({ embedder, state }: { embedder: EmbedderViewModel; state: EmbedderState }) {
  const [provider, setProvider] = useState<EmbedderProvider>(state.provider);
  const [key, setKey] = useState('');
  const [editing, setEditing] = useState(!state.hasKey && !state.account.signedIn);
  const active = activeEmbeddingSource(state) === state.provider;
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

  const select = () => {
    if (busy) return;
    if (!state.hasKey) openEditor();
    else if (!active) embedder.selectProvider(state.provider);
  };

  return (
    <ChoiceRow
      checked={active}
      detail={
        state.hasKey
          ? `${label} key stored`
          : 'OpenAI or OpenRouter, billed to you instead of the hosted credits.'
      }
      label="Your own API key"
      onSelect={select}
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
      value={state.provider}
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
            <Button
              disabled={busy}
              onClick={() => setEditing(false)}
              size="compact"
              variant="ghost"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      {embedder.keyWarning && (
        <p className="mt-1.5 text-caption text-muted-foreground" role="status">
          Saved, but the key could not be verified yet: {embedder.keyWarning}
        </p>
      )}
      {embedder.keyFailure && <FailureNotice className="mt-1.5" failure={embedder.keyFailure} />}
    </ChoiceRow>
  );
}

export function AiIndexPanel({ embedderApi, onOpenExternal }: AiIndexPanelProps) {
  const embedder = useEmbedder(embedderApi, onOpenExternal);
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
      lede="Search by meaning and Agent context use it. Keyword search and every local workflow work without it."
      title="Search by Meaning"
    >
      <SettingsGroup hint={describeEmbedderSource(state)} title="Source">
        <ChoiceList
          aria-label="Provider for search by meaning"
          onValueChange={(value) => {
            if (embedder.selecting || value === activeEmbeddingSource(state)) return;
            if (value === ACCOUNT_SOURCE) {
              if (state.account.signedIn) embedder.useAccount();
            } else if (state.hasKey) {
              embedder.selectProvider(value === 'openrouter' ? 'openrouter' : 'openai');
            }
          }}
          value={activeEmbeddingSource(state)}
        >
          <AccountRow embedder={embedder} state={state} />
          <KeyRow embedder={embedder} state={state} />
        </ChoiceList>
      </SettingsGroup>
    </SettingsPane>
  );
}
