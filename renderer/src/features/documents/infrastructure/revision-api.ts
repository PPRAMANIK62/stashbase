/**
 * The HTTP adapter for the revision proposals an agent parked against a
 * folder. The wire shape stops here: an absolute path becomes the source
 * reference the tabs runtime opens, and the host's `'agent'` tag becomes the
 * origin the review carries.
 *
 * The read consumes what it returns, so a proposal that arrives here exists
 * nowhere else. Nothing in this module discards one: a path that does not
 * resolve inside the drained folder comes back under `unresolved`, because a
 * proposal this window cannot open is still a proposal the agent told the
 * reader it had parked.
 */
import {
  DocumentRevisionsError,
  type DocumentRevisionProposal,
  type DocumentRevisionsFailureKind,
  type DocumentRevisionsPort,
  type DrainedRevisions,
} from '@/features/documents/application/ports';
import { request } from '@/platform/http/classify';
import type { HttpClient } from '@/platform/http/client';
import {
  documentRevisionsResponseSchema,
  type DocumentRevisionProposalWire,
} from '@/protocols/http/document-revisions';
import type { SourceReference } from '@/shared/domain/source-reference';
import { basePathName } from '@/shared/utils/file-path';

const MESSAGES: Readonly<Record<DocumentRevisionsFailureKind, string>> = {
  'invalid-response': 'Revisions parked for this folder could not be read.',
  'scope-lost': 'That folder is no longer available in this window.',
  unauthorized: 'This window can no longer collect revisions for that folder.',
  unavailable: 'Revisions parked for this folder could not be collected.',
};

/**
 * The folder-relative source a proposal names, or null when its path does not
 * sit inside the folder that was drained.
 *
 * The host resolves the requested folder to the registered root that contains
 * it before it drains, and its own module says those two can differ. So this
 * is not only a guard against a broken host filter: it is where a proposal
 * belonging to a sibling of this window's folder is recognised. The tabs
 * runtime opens whatever it is handed, and a path from somewhere else would
 * put a review on a document this window's folder does not own.
 */
function proposalSource(folderPath: string, absolutePath: string): SourceReference | null {
  const root = folderPath.replace(/\/+$/u, '');
  if (!absolutePath.startsWith(`${root}/`)) return null;
  const path = absolutePath.slice(root.length + 1);
  if (path === '' || path.split('/').some((segment) => segment === '' || segment === '..')) {
    return null;
  }
  return { folderPath, path };
}

function mapProposal(
  folderPath: string,
  wire: DocumentRevisionProposalWire,
): DocumentRevisionProposal | null {
  const source = proposalSource(folderPath, wire.path);
  if (!source) return null;
  return {
    id: wire.id,
    baseVersion: wire.baseVersion,
    content: wire.content,
    createdAt: wire.createdAt,
    origin: { kind: wire.origin },
    source,
  };
}

function drained(folderPath: string, wire: readonly DocumentRevisionProposalWire[]) {
  const proposals: DocumentRevisionProposal[] = [];
  const unresolved: string[] = [];
  for (const entry of wire) {
    const proposal = mapProposal(folderPath, entry);
    if (proposal) proposals.push(proposal);
    else unresolved.push(basePathName(entry.path));
  }
  return { proposals, unresolved };
}

export function createDocumentRevisionsAdapter(client: HttpClient): DocumentRevisionsPort {
  return {
    async drain(folderPath, signal): Promise<DrainedRevisions> {
      const query = new URLSearchParams({ folder: folderPath });
      const body = await request(client, {
        error: DocumentRevisionsError,
        messages: MESSAGES,
        path: `/api/document-revisions?${query}`,
        schema: documentRevisionsResponseSchema,
        signal,
      });
      return drained(folderPath, body.proposals);
    },
  };
}
