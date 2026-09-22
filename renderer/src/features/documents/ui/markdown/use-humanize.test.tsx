/**
 * The request as the surface runs it: what is refused before anything is
 * sent, what is sent, and what becomes of the answer when the document did
 * or did not move in the meantime. The Milkdown seam is stood in for here;
 * `humanize-selection.test.ts` proves it against the real editor.
 */
import { act, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  DOCUMENT_HUMANIZE_MESSAGES,
  DOCUMENT_REVISION_MESSAGES,
  HUMANIZE_REFUSAL_MESSAGES,
} from '@/features/documents/application/failure-messages';
import { DocumentHumanizeError } from '@/features/documents/application/ports';
import type { DocumentEditorState } from '@/features/documents/domain/document';
import type { RevisionRefusal } from '@/features/documents/domain/revision';
import { humanizeApi } from '@/test/fakes/documents';

import { humanizeProposal, humanizeTarget } from './humanize-selection';
import { useHumanize, type HumanizeBinding, type HumanizeEditor } from './use-humanize';

vi.mock('./humanize-selection', () => ({
  humanizeProposal: vi.fn(() => '# Title\n\nA plain line.\n'),
  humanizeTarget: vi.fn(() => ({ from: 9, to: 25, markdown: 'A line, comprehensively.\n' })),
}));

const target = vi.mocked(humanizeTarget);
const proposal = vi.mocked(humanizeProposal);

const ctx = Symbol('ctx');
const editor: HumanizeEditor = {
  editor: { action: (run) => run(ctx as never) },
};

function buffer(overrides: Partial<DocumentEditorState> = {}): DocumentEditorState {
  return {
    baseline: '# Title\n\nA line, comprehensively.\n',
    revision: 3,
    save: { kind: 'clean' },
    value: '# Title\n\nA line, comprehensively.\n',
    version: 'sha256:v1',
    ...overrides,
  };
}

interface Harness {
  binding: HumanizeBinding;
  editorState: { current: DocumentEditorState | null };
  reviewOpen: { current: boolean };
  start: ReturnType<typeof vi.fn<HumanizeBinding['start']>>;
}

function harness(api = humanizeApi(), refusal: RevisionRefusal | null = null): Harness {
  const editorState = { current: buffer() as DocumentEditorState | null };
  const reviewOpen = { current: false };
  const start = vi.fn<HumanizeBinding['start']>(() => refusal);
  return {
    binding: {
      api,
      editor: () => editorState.current,
      reviewOpen: () => reviewOpen.current,
      start,
    },
    editorState,
    reviewOpen,
    start,
  };
}

function mount(binding: HumanizeBinding) {
  const editorRef = createRef<HumanizeEditor | null>() as { current: HumanizeEditor | null };
  editorRef.current = editor;
  const hook = renderHook(() => useHumanize(binding, editorRef));
  return { editorRef, hook };
}

/** Stands in until the port is called and hands over the real settlers. */
const unsettled = () => undefined;

/** A port whose answer the test releases. */
function heldApi() {
  let release: (value: { text: string }) => void = unsettled;
  let refuse: (reason: unknown) => void = unsettled;
  const api = humanizeApi({
    humanize: vi.fn(
      () =>
        new Promise<{ text: string }>((resolve, reject) => {
          release = resolve;
          refuse = reject;
        }),
    ),
  });
  return {
    api,
    refuse: (reason: unknown) => refuse(reason),
    release: (text: string) => release({ text }),
  };
}

afterEach(() => {
  vi.clearAllMocks();
  proposal.mockReturnValue('# Title\n\nA plain line.\n');
  target.mockReturnValue({ from: 9, to: 25, markdown: 'A line, comprehensively.\n' });
});

describe('useHumanize', () => {
  it('sends the widened selection and opens the rewrite as a review on the live version', async () => {
    const held = heldApi();
    const { binding, editorState, start } = harness(held.api);
    const { hook } = mount(binding);

    act(() => hook.result.current.run(editor));
    expect(hook.result.current.status).toEqual({ kind: 'running' });
    expect(held.api.humanize).toHaveBeenCalledWith(
      { text: 'A line, comprehensively.\n' },
      expect.any(AbortSignal),
    );

    // Autosave landed while the service worked: same text, newer version.
    editorState.current = buffer({ version: 'sha256:v2' });
    await act(async () => held.release('A plain line.'));

    expect(proposal).toHaveBeenCalledWith(
      ctx,
      { from: 9, to: 25, markdown: 'A line, comprehensively.\n' },
      'A plain line.',
    );
    expect(start).toHaveBeenCalledWith(
      {
        baseVersion: 'sha256:v2',
        id: expect.stringMatching(/^humanize-/),
        origin: { kind: 'humanize' },
        proposal: '# Title\n\nA plain line.\n',
      },
      '# Title\n\nA line, comprehensively.\n',
    );
    expect(hook.result.current.status).toEqual({ kind: 'idle' });
  });

  it('refuses the rewrite when the reader edited the document while it ran', async () => {
    const held = heldApi();
    const { binding, editorState, start } = harness(held.api);
    const { hook } = mount(binding);

    act(() => hook.result.current.run(editor));
    editorState.current = buffer({ revision: 4, value: '# Title\n\nA line, edited.\n' });
    await act(async () => held.release('A plain line.'));

    expect(start).not.toHaveBeenCalled();
    expect(hook.result.current.status).toEqual({
      kind: 'failed',
      message: HUMANIZE_REFUSAL_MESSAGES.changed,
    });
  });

  it('refuses before sending when a review is open or the selection is not prose', () => {
    const api = humanizeApi();
    const { binding, reviewOpen } = harness(api);
    const { hook } = mount(binding);

    reviewOpen.current = true;
    act(() => hook.result.current.run(editor));
    expect(hook.result.current.status).toEqual({
      kind: 'failed',
      message: DOCUMENT_REVISION_MESSAGES['review-in-progress'],
    });

    reviewOpen.current = false;
    target.mockReturnValue('not-prose');
    act(() => hook.result.current.run(editor));
    expect(hook.result.current.status).toEqual({
      kind: 'failed',
      message: HUMANIZE_REFUSAL_MESSAGES['not-prose'],
    });
    expect(api.humanize).not.toHaveBeenCalled();

    act(() => hook.result.current.dismiss());
    expect(hook.result.current.status).toEqual({ kind: 'idle' });
  });

  it("reports the service's refusal on the humanize ladder and a document refusal on the revision one", async () => {
    const held = heldApi();
    const { binding } = harness(held.api, 'stale-version');
    const { hook } = mount(binding);

    act(() => hook.result.current.run(editor));
    await act(async () => held.refuse(new DocumentHumanizeError('busy', 'busy')));
    expect(hook.result.current.status).toEqual({
      kind: 'failed',
      message: DOCUMENT_HUMANIZE_MESSAGES.busy,
    });

    act(() => hook.result.current.dismiss());
    act(() => hook.result.current.run(editor));
    await act(async () => held.release('A plain line.'));
    expect(hook.result.current.status).toEqual({
      kind: 'failed',
      message: DOCUMENT_REVISION_MESSAGES['stale-version'],
    });
  });

  it('drops the answer to a request the reader cancelled, and one for an editor that was rebuilt', async () => {
    const held = heldApi();
    const { binding, start } = harness(held.api);
    const { editorRef, hook } = mount(binding);

    act(() => hook.result.current.run(editor));
    const signal = vi.mocked(held.api.humanize).mock.calls[0]?.[1];
    act(() => hook.result.current.cancel());
    expect(signal?.aborted).toBe(true);
    expect(hook.result.current.status).toEqual({ kind: 'idle' });
    await act(async () => held.release('A plain line.'));
    expect(start).not.toHaveBeenCalled();

    act(() => hook.result.current.run(editor));
    editorRef.current = { editor: { action: (run) => run(ctx as never) } };
    await act(async () => held.release('A plain line.'));
    expect(start).not.toHaveBeenCalled();
    expect(hook.result.current.status).toEqual({
      kind: 'failed',
      message: HUMANIZE_REFUSAL_MESSAGES.changed,
    });
  });
});
