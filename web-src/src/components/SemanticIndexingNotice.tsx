import React from 'react';
import { useApp } from '../store/AppContext';

export function SemanticIndexingNotice() {
  const { state, actions } = useApp();
  const workload = state.semanticIndexing;
  if (!workload || !['awaiting-decision', 'paused', 'partial-paused'].includes(workload.state)) return null;
  const awaiting = workload.state === 'awaiting-decision';
  const count = workload.sourceCount ?? state.pendingSemanticNames.size;
  return <SemanticIndexingNoticeView
    awaiting={awaiting}
    count={count}
    estimatedBytes={workload.estimatedBytes}
    failureMessage={state.indexWarning?.message}
    onStart={() => { void actions.decideSemanticIndexing('start'); }}
    onDefer={() => { void actions.decideSemanticIndexing('defer'); }}
  />;
}

export function SemanticIndexingNoticeView({
  awaiting,
  count,
  estimatedBytes,
  failureMessage,
  onStart,
  onDefer,
}: {
  awaiting: boolean;
  count: number;
  estimatedBytes?: number;
  failureMessage?: string;
  onStart: () => void;
  onDefer: () => void;
}) {
  const size = estimatedBytes
    ? ` · about ${(estimatedBytes / (1024 * 1024)).toFixed(estimatedBytes >= 10 * 1024 * 1024 ? 0 : 1)} MiB`
    : '';
  return (
    <div className="search-status-banner warning" role="status" aria-live="polite">
      <div className="search-status-copy">
        <div className="search-status-title">{awaiting ? 'Large semantic indexing workload' : 'Semantic indexing paused'}</div>
        <div className="search-status-detail">
          About {count.toLocaleString()} file{count === 1 ? '' : 's'} waiting{size}. Indexing may take a while and use embedding-provider quota. Keyword search remains available.
        </div>
        {failureMessage && (
          <div className="search-status-detail" role="alert">
            Search also needs attention: {failureMessage}
          </div>
        )}
      </div>
      <div className="search-status-actions">
        <button type="button" onClick={onStart}>
          {awaiting ? 'Index now' : 'Start indexing'}
        </button>
        {awaiting && <button type="button" onClick={onDefer}>Not now</button>}
      </div>
    </div>
  );
}
