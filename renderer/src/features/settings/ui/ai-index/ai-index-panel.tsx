import { KeyRound, LogIn, LogOut, RefreshCw, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { InputField, InputGroup } from '@/components/ui/input-group';
import { TabsSubtle, TabsSubtleItem } from '@/components/ui/tabs-subtle';
import type {
  EmbedderProvider,
  EmbedderState,
  HostedAccount,
} from '@/features/settings/application/embedder-port';
import type { useEmbedder } from '@/features/settings/hooks/use-embedder';
import {
  ChoiceList,
  ChoiceRow,
  ProgressBar,
  SettingsGroup,
  SettingsPane,
  StatusChip,
} from '@/features/settings/ui/rows';

type Embedder = ReturnType<typeof useEmbedder>;

export interface AiIndexPanelProps {
  embedder: Embedder;
  onOpenExternal(href: string): void;
}

const PROVIDERS: ReadonlyArray<EmbedderProvider> = ['openai', 'openrouter'];

const PROVIDER_LABELS: Record<EmbedderProvider, string> = {
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
};

const ACCOUNT_SOURCE = 'stashbase-account';

function remainingPercent(account: HostedAccount): number {
  const quota = account.quota;
  if (!quota || quota.grantedTokens <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round((quota.remainingTokens / quota.grantedTokens) * 100)),
  );
}

function quotaSummary(account: HostedAccount): string {
  if (account.quotaUnavailable) return 'Usage is temporarily unavailable.';
  const quota = account.quota;
  if (!quota) return 'Usage not reported yet.';
  const reset = quota.periodEndsAt
    ? new Date(quota.periodEndsAt).toLocaleDateString([], { dateStyle: 'medium' })
    : null;
  return `${remainingPercent(account)}% remaining · ${quota.remainingTokens.toLocaleString()} tokens left${reset ? ` · Resets ${reset}` : ''}`;
}

function mutationFailure(
  ...mutations: Array<{ error: Error | null; isError: boolean }>
): string | null {
  const failed = mutations.find((mutation) => mutation.isError);
  return failed ? (failed.error?.message ?? 'The request failed.') : null;
}

function activeSource(state: EmbedderState): string | null {
  return state.authorized ? state.source : null;
}

function sourceHint(state: EmbedderState): string {
  const active = activeSource(state);
  if (active === ACCOUNT_SOURCE) {
    return 'Meaning-based search and indexing use your StashBase account.';
  }
  if (active !== null) {
    return `Meaning-based search and indexing use your ${PROVIDER_LABELS[state.provider]} key.`;
  }
  return 'AI Index is not set up. Sign in or add a key. Exact search keeps working.';
}

function AccountRow({
  embedder,
  onOpenExternal,
  state,
}: AiIndexPanelProps & { state: EmbedderState }) {
  const account = state.account;
  const active = activeSource(state) === ACCOUNT_SOURCE;
  const busy =
    embedder.startSignIn.isPending ||
    embedder.signInPending ||
    embedder.signOut.isPending ||
    embedder.useAccount.isPending ||
    embedder.refreshAccount.isPending;
  const failure =
    embedder.signInError ??
    mutationFailure(
      embedder.startSignIn,
      embedder.signOut,
      embedder.useAccount,
      embedder.refreshAccount,
    );

  const signIn = () =>
    embedder.startSignIn.mutate(undefined, {
      onSuccess: (started) => onOpenExternal(started.url),
    });

  const select = () => {
    if (busy) return;
    if (!account.signedIn) signIn();
    else if (!active) embedder.useAccount.mutate();
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
          'Hosted AI Index with a monthly token allowance.'
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
            onClick={() => embedder.signOut.mutate()}
            size="compact"
            variant="ghost"
          >
            Sign out
          </Button>
        ) : (
          <Button
            disabled={busy}
            leadingIcon={LogIn}
            loading={embedder.startSignIn.isPending || embedder.signInPending}
            onClick={signIn}
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
          <ProgressBar value={remainingPercent(account)} />
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <p className="text-caption text-muted-foreground" role="status">
              {quotaSummary(account)}
            </p>
            <Button
              disabled={busy}
              leadingIcon={RefreshCw}
              onClick={() => embedder.refreshAccount.mutate()}
              size="compact"
              variant="ghost"
            >
              Refresh usage
            </Button>
          </div>
        </>
      )}
      {failure && (
        <p className="mt-1.5 text-caption text-destructive" role="alert">
          {failure}
        </p>
      )}
    </ChoiceRow>
  );
}

function KeyRow({ embedder, state }: { embedder: Embedder; state: EmbedderState }) {
  const [provider, setProvider] = useState<EmbedderProvider>(state.provider);
  const [key, setKey] = useState('');
  const [editing, setEditing] = useState(!state.hasKey && !state.account.signedIn);
  const active = activeSource(state) === state.provider;
  const busy =
    embedder.saveKey.isPending || embedder.removeKey.isPending || embedder.selectProvider.isPending;
  const failure = mutationFailure(embedder.saveKey, embedder.removeKey, embedder.selectProvider);
  const warning = embedder.saveKey.data?.warning ?? null;
  const label = PROVIDER_LABELS[state.provider];

  const openEditor = () => {
    setKey('');
    setEditing(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) return;
    embedder.saveKey.mutate(
      { key: trimmed, provider },
      {
        onSuccess: () => {
          setKey('');
          setEditing(false);
        },
      },
    );
  };

  const select = () => {
    if (busy) return;
    if (!state.hasKey) openEditor();
    else if (!active) embedder.selectProvider.mutate(state.provider);
  };

  return (
    <ChoiceRow
      checked={active}
      detail={
        state.hasKey
          ? `${label} key stored`
          : 'OpenAI or OpenRouter, billed to you instead of the hosted allowance.'
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
              onClick={() => embedder.removeKey.mutate()}
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
            onSelect={(index) => setProvider(PROVIDERS[index] ?? 'openai')}
            selectedIndex={Math.max(0, PROVIDERS.indexOf(provider))}
            size="compact"
          >
            {PROVIDERS.map((candidate, index) => (
              <TabsSubtleItem index={index} key={candidate} label={PROVIDER_LABELS[candidate]} />
            ))}
          </TabsSubtle>
          <InputGroup className="w-full" size="compact">
            <InputField
              autoComplete="off"
              filled
              index={0}
              label={`${PROVIDER_LABELS[provider]} API key`}
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
              loading={embedder.saveKey.isPending}
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
      {warning && (
        <p className="mt-1.5 text-caption text-muted-foreground" role="status">
          Saved, but the key could not be verified yet: {warning}
        </p>
      )}
      {failure && (
        <p className="mt-1.5 text-caption text-destructive" role="alert">
          {failure}
        </p>
      )}
    </ChoiceRow>
  );
}

export function AiIndexPanel({ embedder, onOpenExternal }: AiIndexPanelProps) {
  const state = embedder.state.data;
  if (embedder.state.isPending) {
    return (
      <p className="text-caption text-muted-foreground" role="status">
        Loading AI Index settings…
      </p>
    );
  }
  if (!state) {
    return (
      <div className="flex items-center justify-between gap-2">
        <p className="text-caption text-destructive" role="alert">
          AI Index settings are unavailable.
        </p>
        <Button onClick={() => void embedder.state.refetch()} size="compact" variant="tertiary">
          Retry
        </Button>
      </div>
    );
  }
  const busy = embedder.useAccount.isPending || embedder.selectProvider.isPending;
  return (
    <SettingsPane
      lede="Similar search and Agent context use the AI Index. Exact search and every local workflow work without it."
      title="AI Index"
    >
      <SettingsGroup hint={sourceHint(state)} title="Source">
        <ChoiceList
          aria-label="AI Index source"
          onValueChange={(value) => {
            if (busy || value === activeSource(state)) return;
            if (value === ACCOUNT_SOURCE) {
              if (state.account.signedIn) embedder.useAccount.mutate();
            } else if (state.hasKey) {
              embedder.selectProvider.mutate(value === 'openrouter' ? 'openrouter' : 'openai');
            }
          }}
          value={activeSource(state)}
        >
          <AccountRow embedder={embedder} onOpenExternal={onOpenExternal} state={state} />
          <KeyRow embedder={embedder} state={state} />
        </ChoiceList>
      </SettingsGroup>
    </SettingsPane>
  );
}
