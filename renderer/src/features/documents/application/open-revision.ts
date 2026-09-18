/**
 * Turning one drained proposal into an open review on the document's runtime.
 *
 * A freshly opened tab has no editor yet: its text is loaded by react-query in
 * the React tree, some way after the tab exists. So the review waits for the
 * editor to arrive rather than refusing a document that is merely still
 * loading. Every way the wait can end is a value the caller reports, because
 * the host has already forgotten the proposal by the time this runs.
 */
import type { DocumentEditorState } from '@/features/documents/domain/document';
import { splitLeadingYamlFrontmatter } from '@/features/documents/domain/markdown';
import type { RevisionRefusal } from '@/features/documents/domain/revision';

import type { DocumentRuntime } from './document-runtime';
import type { DocumentRevisionProposal, DocumentSourcePort } from './ports';

/** Long enough for a large document to finish its first read over a busy
 *  local server, short enough that a tab which will never load stops holding
 *  the proposal's only report of itself. */
const EDITOR_WAIT_MS = 20_000;

/** Why a drained proposal never became a review. Everything here is said to
 *  the reader: the host has already forgotten the proposal. */
export type RevisionPickupFailure = RevisionRefusal | 'not-opened' | 'not-verified';

/** The document's editor once it has text, or null when the runtime was
 *  disposed or the wait ran out first. */
function waitForEditor(runtime: DocumentRuntime): Promise<DocumentEditorState | null> {
  const present = runtime.store.getState().editor;
  if (present) return Promise.resolve(present);
  if (runtime.signal.aborted) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    let release: (() => void) | null = null;
    const abort = () => settle(null);
    const timer = setTimeout(() => settle(null), EDITOR_WAIT_MS);

    function settle(editor: DocumentEditorState | null): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      release?.();
      runtime.signal.removeEventListener('abort', abort);
      resolve(editor);
    }

    runtime.signal.addEventListener('abort', abort);
    release = runtime.store.subscribe((state) => {
      if (state.editor) settle(state.editor);
    });
  });
}

/** Opens `proposal` as a review on `runtime`. Answers why it could not be
 *  opened, or null once the review is up. */
export async function openDocumentRevision(
  runtime: DocumentRuntime,
  proposal: DocumentRevisionProposal,
  sourceApi: DocumentSourcePort,
): Promise<RevisionPickupFailure | null> {
  const editor = await waitForEditor(runtime);
  if (!editor) return 'not-opened';
  const scope = runtime.capture();
  let currentVersion: string;
  try {
    const source = await sourceApi.load(runtime.scope.source, runtime.signal);
    currentVersion = source.version;
  } catch {
    return 'not-verified';
  }
  let result: RevisionPickupFailure | null = 'not-opened';
  const accepted = runtime.accept(scope, () => {
    if (currentVersion !== proposal.baseVersion) {
      result = 'stale-version';
      return;
    }
    const current = splitLeadingYamlFrontmatter(
      runtime.store.getState().editor?.value ?? editor.value,
    );
    const proposed = splitLeadingYamlFrontmatter(proposal.content);
    if (current.source !== proposed.source) {
      result = 'frontmatter-changed';
      return;
    }
    result = runtime.startRevision(
      {
        baseVersion: proposal.baseVersion,
        id: proposal.id,
        origin: proposal.origin,
        proposal: proposed.body,
      },
      current.body,
    );
  });
  return accepted ? result : 'not-opened';
}
