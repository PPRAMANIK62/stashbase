/**
 * Picking up the revision proposals an agent parked for this window's folder,
 * and opening the review the reader asks for of what an Agent turn changed.
 * Both end in an open review on a kept tab or in one sentence on the notice
 * strip, and both go through one queue so two opens never race on one tab.
 *
 * `GET /api/document-revisions` deletes what it returns, and the agent has
 * already told the user the proposal was parked for review. So a proposal that
 * reaches this hook and does not become an open review is work the reader was
 * promised and will never get, and every one of those ways out ends in a
 * sentence on the notice strip rather than in a dropped value.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { openDocument } from '@/app/workflows/open-document';
import {
  documentRevisionPickupMessage,
  openDocumentRevision,
  openTurnChangeReview,
  turnChangeReviewMessage,
  useRevisionProposals,
  type DocumentAdapters,
  type DocumentRevisionProposal,
  type DocumentTabsRuntime,
  type DrainedRevisions,
} from '@/features/documents/public';
import type { WorkspaceRuntime } from '@/features/workspace/public';
import type { SourceReference } from '@/shared/domain/source-reference';
import { basePathName } from '@/shared/utils/file-path';

export interface RevisionPickup {
  /** Proposals that were drained and could not be shown, one sentence each.
   *  The host has forgotten them, so these are the only record the reader
   *  will ever get. */
  readonly failures: readonly string[];
  dismiss(message: string): void;
  /** Opens the file as a kept tab and reviews what turn `turnId` changed in
   *  it; a refusal lands in `failures`. */
  reviewTurnChange(request: { source: SourceReference; turnId: string }): void;
}

/** Opens one proposal's document as a kept tab and starts its review. A
 *  review the reader has to act on is not a glance, which is why the tab
 *  stays rather than taking the preview slot. */
async function pickUpProposal(
  workspace: WorkspaceRuntime,
  documents: DocumentTabsRuntime,
  proposal: DocumentRevisionProposal,
  sourceApi: DocumentAdapters['source'],
) {
  if (proposal.source.folderPath !== documents.scope.folderPath) return 'outside-folder' as const;
  try {
    const document = await openDocument(workspace, documents, proposal.source, { preview: false });
    if (!document) return 'not-opened' as const;
    return await openDocumentRevision(document, proposal, sourceApi);
  } catch {
    // A rejected open is the proposal never reaching a tab. The host has
    // already forgotten it, so it is reported rather than rethrown into a
    // poll nobody is watching.
    return 'not-opened' as const;
  }
}

/** Opens the file a turn changed as a kept tab and starts the reversed
 *  review of that turn on it. */
async function reviewTurn(
  workspace: WorkspaceRuntime,
  documents: DocumentTabsRuntime,
  request: { source: SourceReference; turnId: string },
  ports: Pick<DocumentAdapters, 'source' | 'turnChanges'>,
) {
  if (request.source.folderPath !== documents.scope.folderPath) return 'outside-folder' as const;
  try {
    const document = await openDocument(workspace, documents, request.source, { preview: false });
    if (!document) return 'not-opened' as const;
    return await openTurnChangeReview(document, request.turnId, ports);
  } catch {
    // A rejected open is the review never reaching a tab, which the reader
    // asked for and is told about rather than left waiting.
    return 'not-opened' as const;
  }
}

export function useRevisionPickup({
  api,
  documents,
  sourceApi,
  turnChangesApi,
  workspace,
}: {
  api: DocumentAdapters['revisions'];
  documents: DocumentTabsRuntime | null;
  sourceApi: DocumentAdapters['source'];
  turnChangesApi: DocumentAdapters['turnChanges'];
  workspace: WorkspaceRuntime | null;
}): RevisionPickup {
  const [failures, setFailures] = useState<readonly string[]>([]);
  // A drain with nowhere to put the result would destroy it, so the poll only
  // runs while both runtimes are live.
  const live = workspace !== null && documents !== null ? documents : null;
  const folderPath = live?.scope.folderPath ?? null;

  useEffect(() => {
    setFailures((current) => (current.length === 0 ? current : []));
  }, [folderPath]);

  // Proposals are taken one at a time, in order. Two proposals for the same
  // document have to produce one open review and one refusal, which a
  // parallel handoff would turn into a race between two opens.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const report = useCallback((message: string) => {
    setFailures((current) => (current.includes(message) ? current : [...current, message]));
  }, []);

  const onProposals = useCallback(
    (drained: DrainedRevisions) => {
      if (!workspace || !documents) return;
      // A proposal whose path did not resolve inside this folder never had a
      // document here to open. It is still named, because the drain consumed
      // it and the agent has already said it was parked.
      for (const name of drained.unresolved) {
        report(documentRevisionPickupMessage('outside-folder', name));
      }
      queue.current = queue.current.then(async () => {
        for (const proposal of drained.proposals) {
          const failure = await pickUpProposal(workspace, documents, proposal, sourceApi);
          if (failure === null) continue;
          report(documentRevisionPickupMessage(failure, basePathName(proposal.source.path)));
        }
      });
    },
    [documents, report, sourceApi, workspace],
  );

  const onFailure = useCallback(
    (failedFolder: string) => {
      report(
        `Could not confirm delivery of suggested revisions for ${basePathName(failedFolder)}. Ask the Agent to propose them again if they do not appear.`,
      );
    },
    [report],
  );

  useRevisionProposals(api, folderPath, onProposals, onFailure);

  const reviewTurnChange = useCallback(
    (request: { source: SourceReference; turnId: string }) => {
      if (!workspace || !documents) return;
      queue.current = queue.current.then(async () => {
        const failure = await reviewTurn(workspace, documents, request, {
          source: sourceApi,
          turnChanges: turnChangesApi,
        });
        if (failure === null) return;
        report(turnChangeReviewMessage(failure, basePathName(request.source.path)));
      });
    },
    [documents, report, sourceApi, turnChangesApi, workspace],
  );

  const dismiss = useCallback((message: string) => {
    setFailures((current) => current.filter((entry) => entry !== message));
  }, []);

  return { dismiss, failures, reviewTurnChange };
}
