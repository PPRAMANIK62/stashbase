/**
 * Humanize on the Markdown surface: the selection goes to Hemmingway-1 and
 * the rewrite comes back as a revision review on the same document.
 *
 * The request is the one thing here with a life of its own. Everything it
 * needs is read at the moment it is needed, through the binding, rather than
 * captured at render: the buffer's edit counter before the request and after
 * it, so a rewrite of text the reader has since changed is refused instead
 * of striking their newer edits; and the document runtime's own start, so
 * the review opens through the same door an agent's proposal does.
 */
import type { Ctx } from '@milkdown/kit/ctx';
import { useCallback, useRef, useState, type RefObject } from 'react';

import {
  DOCUMENT_HUMANIZE_MESSAGES,
  DOCUMENT_REVISION_MESSAGES,
  documentFailure,
  HUMANIZE_REFUSAL_MESSAGES,
} from '@/features/documents/application/failure-messages';
import type { DocumentHumanizePort } from '@/features/documents/application/ports';
import type { DocumentEditorState } from '@/features/documents/domain/document';
import type { HumanizeStatus } from '@/features/documents/domain/humanize';
import { splitLeadingYamlFrontmatter } from '@/features/documents/domain/markdown';
import type { RevisionRefusal, RevisionReview } from '@/features/documents/domain/revision';
import { useRequestSignals } from '@/shared/runtime/use-request-signals';

import { humanizeProposal, humanizeTarget } from './humanize-selection';

/** What the surface needs from the document runtime to turn a rewrite into
 *  a review, read live rather than captured. */
export interface HumanizeBinding {
  api: DocumentHumanizePort;
  /** The buffer in front of the reader: its saved version, its edit counter
   *  and its text. */
  editor(): DocumentEditorState | null;
  /** True while a review already holds the document. */
  reviewOpen(): boolean;
  /** The document runtime's own start, so the review opens the way an
   *  agent's proposal does. */
  start(review: RevisionReview, currentBody: string): RevisionRefusal | null;
}

/** The part of a Crepe editor the request reads: a way to run against the
 *  editor's context. Named structurally so a test can stand one in. */
export interface HumanizeEditor {
  readonly editor: { action<T>(run: (ctx: Ctx) => T): T };
}

export interface HumanizeControls {
  /** Withdraws the request in flight. The service's answer, if it still
   *  arrives, is dropped rather than reviewed. */
  cancel(): void;
  /** Clears a refusal the reader has read. */
  dismiss(): void;
  /** Sends the selection on `editor`. The selection is read now; the rewrite
   *  is placed later, on the same editor, if nothing moved in between. */
  run(editor: HumanizeEditor): void;
  readonly status: HumanizeStatus;
}

const failed = (message: string): HumanizeStatus => ({ kind: 'failed', message });

export function useHumanize(
  binding: HumanizeBinding | undefined,
  editorRef: RefObject<HumanizeEditor | null>,
): HumanizeControls {
  const [status, setStatus] = useState<HumanizeStatus>({ kind: 'idle' });
  // The binding is rebuilt by the viewer on every render; the request reads
  // it through a ref so it neither restarts nor holds a stale runtime.
  const bindingRef = useRef(binding);
  bindingRef.current = binding;
  // State lands a render later; a second click in the meantime must not
  // start a second request against the same selection.
  const runningRef = useRef(false);
  const signalFor = useRequestSignals<'humanize'>();

  const run = useCallback(
    (editor: HumanizeEditor) => {
      const bound = bindingRef.current;
      if (!bound || runningRef.current) return;
      if (bound.reviewOpen()) {
        setStatus(failed(DOCUMENT_REVISION_MESSAGES['review-in-progress']));
        return;
      }
      const before = bound.editor();
      if (!before) {
        setStatus(failed(DOCUMENT_REVISION_MESSAGES['not-editable']));
        return;
      }
      const target = editor.editor.action((ctx) => humanizeTarget(ctx));
      if (typeof target === 'string') {
        setStatus(failed(HUMANIZE_REFUSAL_MESSAGES[target]));
        return;
      }
      const signal = signalFor('humanize');
      runningRef.current = true;
      setStatus({ kind: 'running' });
      const settle = (next: HumanizeStatus) => {
        runningRef.current = false;
        setStatus(next);
      };
      void bound.api.humanize({ text: target.markdown }, signal).then(
        (result) => {
          if (signal.aborted) return;
          const live = bindingRef.current?.editor() ?? null;
          if (editorRef.current !== editor || !live || live.revision !== before.revision) {
            settle(failed(HUMANIZE_REFUSAL_MESSAGES.changed));
            return;
          }
          const proposal = editor.editor.action((ctx) =>
            humanizeProposal(ctx, target, result.text),
          );
          if (proposal === 'unchanged' || proposal === 'unusable') {
            settle(failed(HUMANIZE_REFUSAL_MESSAGES[proposal]));
            return;
          }
          const refusal = bindingRef.current?.start(
            {
              baseVersion: live.version,
              id: `humanize-${globalThis.crypto.randomUUID()}`,
              origin: { kind: 'humanize' },
              proposal,
            },
            splitLeadingYamlFrontmatter(live.value).body,
          );
          settle(
            refusal === null || refusal === undefined
              ? { kind: 'idle' }
              : failed(DOCUMENT_REVISION_MESSAGES[refusal]),
          );
        },
        (error: unknown) => {
          if (signal.aborted) return;
          settle(
            failed(
              documentFailure(error, 'DocumentHumanizeError', DOCUMENT_HUMANIZE_MESSAGES).message,
            ),
          );
        },
      );
    },
    [editorRef, signalFor],
  );

  const cancel = useCallback(() => {
    // Opening the lane's next signal is what aborts the one in flight.
    signalFor('humanize');
    runningRef.current = false;
    setStatus({ kind: 'idle' });
  }, [signalFor]);

  const dismiss = useCallback(() => {
    setStatus((current) => (current.kind === 'failed' ? { kind: 'idle' } : current));
  }, []);

  return { cancel, dismiss, run, status };
}
