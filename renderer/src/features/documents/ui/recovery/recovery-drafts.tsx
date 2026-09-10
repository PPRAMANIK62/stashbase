/**
 * The strip that offers unsaved text a previous session left behind. It is a
 * decision surface, not a notice: each draft is restored into its document as
 * unsaved edits or discarded, and the strip leaves once every draft has been
 * decided. Nothing here touches the source on disk.
 */
import { useStore } from 'zustand';

import { Button } from '@/components/ui/button';
import type { RecoveryRuntime } from '@/features/documents/application/recovery-runtime';
import { sourceName } from '@/features/documents/domain/document';
import {
  recoveryCandidateKey,
  recoveryCandidateNote,
  type RecoveryCandidate,
} from '@/features/documents/domain/recovery';

const TITLE = 'Unsaved changes from a previous session';

function savedAtLabel(savedAt: string): string {
  const at = new Date(savedAt);
  if (Number.isNaN(at.getTime())) return savedAt;
  return at.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function CandidateRow({
  candidate,
  onDiscard,
  onRestore,
  pending,
}: {
  candidate: RecoveryCandidate;
  onDiscard(): void;
  onRestore(): void;
  pending: 'discard' | 'restore' | null;
}) {
  const name = sourceName(candidate.source);
  const note = recoveryCandidateNote(candidate);
  return (
    <li
      aria-busy={pending !== null}
      aria-label={`${name} draft`}
      className="flex items-center gap-3 py-1.5"
      data-recovery-staleness={candidate.staleness}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-caption">
          <span className="font-medium text-foreground">{name}</span>
          <span className="text-muted-foreground"> saved {savedAtLabel(candidate.savedAt)}</span>
        </p>
        {(candidate.source.path !== name || note) && (
          <p className="truncate text-caption text-muted-foreground">
            {candidate.source.path !== name && candidate.source.path}
            {note && (
              <>
                {candidate.source.path !== name && ' '}
                <span className="text-destructive">{note}</span>
              </>
            )}
          </p>
        )}
      </div>
      <Button
        aria-label={`Restore ${name} draft`}
        disabled={pending !== null}
        loading={pending === 'restore'}
        onClick={onRestore}
        size="compact"
        variant="secondary"
      >
        Restore
      </Button>
      <Button
        aria-label={`Discard ${name} draft`}
        disabled={pending !== null}
        loading={pending === 'discard'}
        onClick={onDiscard}
        size="compact"
        variant="tertiary"
      >
        Discard
      </Button>
    </li>
  );
}

export function RecoveryDrafts({ runtime }: { runtime: RecoveryRuntime }) {
  const candidates = useStore(runtime.store, (state) => state.candidates);
  const refusal = useStore(runtime.store, (state) => state.failure);
  const pending = useStore(runtime.store, (state) => state.pending);
  const status = useStore(runtime.store, (state) => state.status);
  if (status !== 'ready' || candidates.length === 0) return null;
  const busy = Object.keys(pending).length > 0;

  return (
    <section
      aria-label={TITLE}
      className="shrink-0 border-b border-border bg-surface-2 px-4 py-2"
      data-recovery-drafts=""
    >
      <div className="flex items-center gap-3">
        <h2 className="min-w-0 flex-1 truncate text-caption font-medium">{TITLE}</h2>
        <Button
          disabled={busy}
          onClick={() => void runtime.discardAll()}
          size="compact"
          variant="tertiary"
        >
          Discard all
        </Button>
      </div>
      {refusal && (
        <p className="py-1 text-caption text-destructive" role="alert">
          {refusal.message}
        </p>
      )}
      <ul className="divide-y divide-border">
        {candidates.map((candidate) => {
          const key = recoveryCandidateKey(candidate);
          return (
            <CandidateRow
              candidate={candidate}
              key={key}
              onDiscard={() => void runtime.discard(candidate)}
              onRestore={() => void runtime.restore(candidate)}
              pending={pending[key] ?? null}
            />
          );
        })}
      </ul>
    </section>
  );
}
