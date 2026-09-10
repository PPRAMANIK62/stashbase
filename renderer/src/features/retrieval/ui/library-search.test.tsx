import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type {
  ExactSearchPort,
  IndexDecisionPort,
  SemanticSearchPort,
} from '@/features/retrieval/application/ports';
import type {
  ExactSearchFile,
  SearchNavigationIntent,
  ExactSearchResult,
} from '@/features/retrieval/domain/exact-search';
import type {
  PreparationCounts,
  SemanticReadiness,
} from '@/features/retrieval/domain/semantic-readiness';
import type { SemanticSearchResult } from '@/features/retrieval/domain/semantic-search';
import { expectFocused, expectNotFocused } from '@/test/dom';
import { exactSearchApi, indexDecisionApi, semanticSearchApi } from '@/test/fakes/retrieval';
import { createTestQueryClient, queryWrapper } from '@/test/query';

import { LibrarySearch, type LibrarySearchProps } from './library-search';

const noPreparation: PreparationCounts = { blocked: 0, cancelled: 0, failed: 0, pending: 0 };

const READY_INDEX: SemanticReadiness = { state: 'ready' };

const semanticResult: SemanticSearchResult = {
  hits: [
    {
      chunkIndex: 1,
      content: 'Meaningful chunk about answers.\nMore text.',
      heading: 'Answers',
      id: '/library/research\u0000notes/idea.md\u00001',
      score: 0.9,
      snippet: 'Meaningful chunk about answers. More text.',
      source: { folderPath: '/library/research', path: 'notes/idea.md' },
      startLine: 12,
    },
    {
      chunkIndex: 0,
      content: 'Another folder chunk.',
      heading: '',
      id: '/library/archive\u0000old.md\u00000',
      score: 0.5,
      snippet: 'Another folder chunk.',
      source: { folderPath: '/library/archive', path: 'old.md' },
      startLine: 2,
    },
  ],
  truncated: false,
};

const resultFile: ExactSearchFile = {
  id: '/library/archive\u0000notes/answer.md',
  matches: [
    {
      line: 7,
      ranges: [{ end: 10, start: 4 }],
      text: 'The answer is preserved here.',
    },
  ],
  source: { folderPath: '/library/research', path: 'notes/answer.md' },
  totalMatches: 2,
};

const result: ExactSearchResult = {
  files: [resultFile],
  totalMatches: 2,
  truncated: true,
};

afterEach(cleanup);

interface RenderOptions {
  decisions?: IndexDecisionPort;
  onNavigate?: LibrarySearchProps['onNavigate'];
  onOpenSettings?: LibrarySearchProps['onOpenSettings'];
  preparation?: PreparationCounts;
  readiness?: SemanticReadiness;
  readyCount?: number;
  semanticApi?: SemanticSearchPort;
}

function renderSearch(api: ExactSearchPort, options: RenderOptions = {}) {
  const queryClient = createTestQueryClient();
  const QueryWrapper = queryWrapper(queryClient);
  const onNavigate = options.onNavigate ?? vi.fn(async (_intent: SearchNavigationIntent) => true);
  const onOpenSettings =
    options.onOpenSettings ?? vi.fn((_section: 'ai-index' | 'transcription') => undefined);
  const decisions = options.decisions ?? indexDecisionApi();
  const semantic = options.semanticApi ?? semanticSearchApi();
  const element = (focusRevision: number) => (
    <QueryWrapper>
      <LibrarySearch
        active
        activeFolderPath="/library/research"
        decisionApi={decisions}
        exactApi={api}
        focusRevision={focusRevision}
        onNavigate={onNavigate}
        onOpenSettings={onOpenSettings}
        preparation={options.preparation ?? noPreparation}
        readiness={options.readiness ?? READY_INDEX}
        readyCount={options.readyCount ?? 5}
        semanticApi={semantic}
      />
    </QueryWrapper>
  );
  const rendered = render(element(0));
  return { ...rendered, decisions, element, onNavigate, onOpenSettings, queryClient };
}

describe('Library Search', () => {
  it('searches only the active workspace and presents occurrence evidence', async () => {
    const api = exactSearchApi({ search: vi.fn(async () => result) });
    const rendered = renderSearch(api);
    const input = screen.getByRole('combobox', { name: 'Search current workspace' });

    await userEvent.setup().type(input, 'answer');

    const option = await screen.findByRole('option', {
      name: /answer\.md, notes, Line 7, The answer is preserved here\./u,
    });
    expect(api.search).toHaveBeenCalledWith(
      {
        caseSensitive: false,
        folderPath: '/library/research',
        query: 'answer',
        wholeWord: false,
      },
      expect.any(AbortSignal),
    );
    expect(within(option).getByRole('mark').textContent).toBe('answer');
    expect(screen.getByText('notes')).not.toBeNull();
    expect(screen.getByText('2')).not.toBeNull();
    expect(screen.getByText(/Showing the first results from 2 matches/u)).not.toBeNull();

    await userEvent.setup().keyboard('{Enter}');
    await waitFor(() =>
      expect(rendered.onNavigate).toHaveBeenCalledWith({
        source: { folderPath: '/library/research', path: 'notes/answer.md' },
        target: {
          caseSensitive: false,
          line: 7,
          occurrenceIndex: 0,
          query: 'answer',
          wholeWord: false,
        },
        type: 'open-search-source',
      }),
    );
  });

  it('does not surface a result returned outside the selected workspace', async () => {
    const api = exactSearchApi({
      search: vi.fn(async () => ({
        ...result,
        files: [
          {
            ...resultFile,
            id: '/library/archive\u0000notes/answer.md',
            source: { folderPath: '/library/archive', path: 'notes/answer.md' },
          },
        ],
      })),
    });
    renderSearch(api);

    await userEvent
      .setup()
      .type(screen.getByRole('combobox', { name: 'Search current workspace' }), 'answer');

    expect(await screen.findByText('No exact matches.')).not.toBeNull();
    expect(screen.queryByRole('option', { name: /answer\.md/u })).toBeNull();
  });

  it('opens the keyboard-selected occurrence rather than only its file', async () => {
    const repeated: ExactSearchResult = {
      files: [
        {
          ...resultFile,
          matches: [
            {
              line: 7,
              ranges: [
                { end: 10, start: 4 },
                { end: 24, start: 18 },
              ],
              text: 'The answer keeps answer.',
            },
          ],
        },
      ],
      totalMatches: 2,
      truncated: false,
    };
    const api = exactSearchApi({ search: vi.fn(async () => repeated) });
    const rendered = renderSearch(api);
    const user = userEvent.setup();

    await user.type(screen.getByRole('combobox', { name: 'Search current workspace' }), 'answer');
    await screen.findAllByRole('option', { name: /answer\.md/u });
    await user.keyboard('{ArrowDown}{Enter}');

    await waitFor(() =>
      expect(rendered.onNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ occurrenceIndex: 1 }),
        }),
      ),
    );
  });

  it('focuses the query again whenever the search command revision changes', async () => {
    const api = exactSearchApi({ search: vi.fn(async () => result) });
    const rendered = renderSearch(api);
    const input = screen.getByRole('combobox', { name: 'Search current workspace' });
    const elsewhere = rendered.baseElement.ownerDocument.createElement('button');
    rendered.baseElement.append(elsewhere);
    elsewhere.focus();
    expectNotFocused(input);

    rendered.rerender(rendered.element(1));

    await waitFor(() => expectFocused(input));
  });

  it('cancels an obsolete request as soon as the query changes', async () => {
    let firstSignal: AbortSignal | undefined;
    const api = exactSearchApi({
      search: vi.fn((_request, signal) => {
        firstSignal ??= signal;
        return new Promise<ExactSearchResult>(() => undefined);
      }),
    });
    renderSearch(api);
    const user = userEvent.setup();
    const input = screen.getByRole('combobox', { name: 'Search current workspace' });

    await user.type(input, 'alpha');
    await waitFor(() => expect(api.search).toHaveBeenCalledOnce());
    await user.type(input, ' beta');

    await waitFor(() => expect(firstSignal?.aborted).toBe(true));
  });

  it('switches to search by meaning within the selected folder and navigates by chunk anchor', async () => {
    const semanticApi = semanticSearchApi({ search: vi.fn(async () => semanticResult) });
    const exactApi = exactSearchApi({ search: vi.fn(async () => result) });
    const rendered = renderSearch(exactApi, { semanticApi });
    const user = userEvent.setup();

    await user.click(screen.getByRole('tab', { name: 'By meaning' }));
    expect(screen.queryByRole('combobox', { name: 'Search scope' })).toBeNull();
    await user.type(screen.getByRole('combobox', { name: 'Search current workspace' }), 'answers');

    const option = await screen.findByRole('option', { name: /idea\.md, notes, Answers/u });
    expect(semanticApi.search).toHaveBeenCalledWith(
      { folderPath: '/library/research', query: 'answers', topK: 30 },
      expect.any(AbortSignal),
    );
    expect(exactApi.search).not.toHaveBeenCalled();
    expect(screen.queryByRole('group')).toBeNull();
    expect(within(option).queryByRole('mark')).toBeNull();

    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(rendered.onNavigate).toHaveBeenCalledWith({
        source: { folderPath: '/library/research', path: 'notes/idea.md' },
        target: {
          caseSensitive: false,
          line: 12,
          occurrenceIndex: 0,
          query: 'Meaningful chunk about answers.',
          wholeWord: false,
        },
        type: 'open-search-source',
      }),
    );
  });

  it('explains missing search-by-meaning setup without sending a request and keeps keyword search usable', async () => {
    const semanticApi = semanticSearchApi({ search: vi.fn(async () => semanticResult) });
    const exactApi = exactSearchApi({ search: vi.fn(async () => result) });
    const rendered = renderSearch(exactApi, {
      readiness: { state: 'not-set-up' },
      semanticApi,
    });
    const user = userEvent.setup();

    const similarTab = screen.getByRole('tab', { name: 'By meaning' });
    expect(similarTab.getAttribute('title')).toBe(
      'Find matches even when the wording differs — needs setup',
    );
    await user.click(similarTab);
    await user.type(screen.getByRole('combobox', { name: 'Search current workspace' }), 'answers');

    expect(
      screen.getByText('To search by meaning, set it up in StashBase Settings.'),
    ).not.toBeNull();
    expect(screen.getByText('Keyword search keeps working without it.')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Open Settings' }));
    expect(rendered.onOpenSettings).toHaveBeenCalledWith('ai-index');
    expect(semanticApi.search).not.toHaveBeenCalled();

    await user.click(screen.getByRole('tab', { name: 'By keyword' }));
    expect(await screen.findByRole('option', { name: /answer\.md/u })).not.toBeNull();
  });

  it('offers the search-by-meaning workload decision in both modes and forwards it folder-explicitly', async () => {
    const exactApi = exactSearchApi({ search: vi.fn(async () => result) });
    const rendered = renderSearch(exactApi, {
      readiness: {
        state: 'awaiting-decision',
        workload: { estimatedBytes: 2 * 1024 * 1024, files: 40 },
      },
    });

    expect(screen.getByText('Many files need preparation for search by meaning')).not.toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Prepare files' }));
    await waitFor(() =>
      expect(rendered.decisions.decide).toHaveBeenCalledWith(
        '/library/research',
        'start',
        expect.any(AbortSignal),
      ),
    );
  });

  it('shows the preparation readiness line with a transcription setup action', async () => {
    const exactApi = exactSearchApi({ search: vi.fn(async () => result) });
    const rendered = renderSearch(exactApi, {
      preparation: { blocked: 2, cancelled: 0, failed: 0, pending: 0 },
      readyCount: 7,
    });

    expect(screen.getByText('Transcription setup required')).not.toBeNull();
    expect(
      screen.getByText('7 files ready to search. 2 media files need transcription setup.'),
    ).not.toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Open Settings' }));
    expect(rendered.onOpenSettings).toHaveBeenCalledWith('transcription');
  });

  it('surfaces the index warning with retry and dismiss', async () => {
    const exactApi = exactSearchApi({ search: vi.fn(async () => result) });
    const rendered = renderSearch(exactApi, {
      readiness: { state: 'failed', warning: 'daemon restarted' },
    });

    expect(screen.getByText('Search may be incomplete: daemon restarted')).not.toBeNull();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() =>
      expect(rendered.decisions.dismissWarning).toHaveBeenCalledWith(
        '/library/research',
        expect.any(AbortSignal),
      ),
    );
  });
});
