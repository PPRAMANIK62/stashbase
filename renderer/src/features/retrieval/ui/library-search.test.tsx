import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type {
  ExactSearchApi,
  IndexDecisionApi,
  SemanticSearchApi,
} from '@/features/retrieval/application/ports';
import type {
  ExactSearchNavigationIntent,
  ExactSearchResult,
} from '@/features/retrieval/domain/exact-search';
import type { PreparationCounts } from '@/features/retrieval/domain/semantic-readiness';
import type { SemanticSearchResult } from '@/features/retrieval/domain/semantic-search';
import type { FolderIndexStatus, SemanticIndexStatus } from '@/shared/domain/folder-index-status';

import { LibrarySearch, type LibrarySearchProps } from './library-search';

const noPreparation: PreparationCounts = { blocked: 0, cancelled: 0, failed: 0, pending: 0 };

function semanticStatus(overrides: Partial<SemanticIndexStatus> = {}): SemanticIndexStatus {
  return {
    available: true,
    disabledReason: null,
    enabled: true,
    estimatedBytes: null,
    indexReady: true,
    pending: [],
    settled: true,
    sourceCount: null,
    state: 'ready',
    warning: null,
    ...overrides,
  };
}

function folderStatus(
  semantic: Partial<SemanticIndexStatus> = {},
  overrides: Partial<FolderIndexStatus> = {},
): FolderIndexStatus {
  return {
    blockedConversions: [],
    conversionProgress: {},
    conversionRevision: 0,
    conversionVersions: {},
    folderPath: '/library/research',
    indexed: 4,
    pendingConversions: [],
    preparationFailures: [],
    semantic: semanticStatus(semantic),
    total: 5,
    treeVersion: 0,
    ...overrides,
  };
}

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

const idleSemanticApi: SemanticSearchApi = {
  search: vi.fn(async () => ({ hits: [], truncated: false })),
};

function decisionApi(): IndexDecisionApi {
  return {
    decide: vi.fn(async () => undefined),
    dismissWarning: vi.fn(async () => undefined),
    resync: vi.fn(async () => undefined),
  };
}

const result: ExactSearchResult = {
  files: [
    {
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
    },
  ],
  totalMatches: 2,
  truncated: true,
};

let getAnimationsDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  getAnimationsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'getAnimations');
  Object.defineProperty(Element.prototype, 'getAnimations', {
    configurable: true,
    value: vi.fn(() => []),
  });
});

afterEach(() => {
  cleanup();
  if (getAnimationsDescriptor) {
    Object.defineProperty(Element.prototype, 'getAnimations', getAnimationsDescriptor);
  } else {
    Reflect.deleteProperty(Element.prototype, 'getAnimations');
  }
});

interface RenderOptions {
  decisions?: IndexDecisionApi;
  onNavigate?: LibrarySearchProps['onNavigate'];
  onOpenSettings?: LibrarySearchProps['onOpenSettings'];
  preparation?: PreparationCounts;
  semanticApi?: SemanticSearchApi;
  status?: FolderIndexStatus | null;
}

function renderSearch(api: ExactSearchApi, options: RenderOptions = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onNavigate =
    options.onNavigate ?? vi.fn(async (_intent: ExactSearchNavigationIntent) => true);
  const onOpenSettings =
    options.onOpenSettings ?? vi.fn((_section: 'ai-index' | 'transcription') => undefined);
  const decisions = options.decisions ?? decisionApi();
  const element = (focusRevision: number) => (
    <QueryClientProvider client={queryClient}>
      <LibrarySearch
        active
        activeFolderPath="/library/research"
        decisionApi={decisions}
        exactApi={api}
        focusRevision={focusRevision}
        onNavigate={onNavigate}
        onOpenSettings={onOpenSettings}
        preparation={options.preparation ?? noPreparation}
        semanticApi={options.semanticApi ?? idleSemanticApi}
        status={options.status === undefined ? folderStatus() : options.status}
      />
    </QueryClientProvider>
  );
  const rendered = render(element(0));
  return { ...rendered, decisions, element, onNavigate, onOpenSettings, queryClient };
}

describe('Library Search', () => {
  it('searches only the active workspace and presents occurrence evidence', async () => {
    const api: ExactSearchApi = { search: vi.fn(async () => result) };
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
    expect(option.querySelector('mark')?.textContent).toBe('answer');
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
    const api: ExactSearchApi = {
      search: vi.fn(async () => ({
        ...result,
        files: [
          {
            ...result.files[0],
            id: '/library/archive\u0000notes/answer.md',
            source: { folderPath: '/library/archive', path: 'notes/answer.md' },
          },
        ],
      })),
    };
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
          ...result.files[0],
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
    const api: ExactSearchApi = { search: vi.fn(async () => repeated) };
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
    const api: ExactSearchApi = { search: vi.fn(async () => result) };
    const rendered = renderSearch(api);
    const input = screen.getByRole('combobox', { name: 'Search current workspace' });
    const elsewhere = globalThis.document.createElement('button');
    globalThis.document.body.append(elsewhere);
    elsewhere.focus();

    rendered.rerender(rendered.element(1));

    await waitFor(() => expect(globalThis.document.activeElement).toBe(input));
  });

  it('cancels an obsolete request as soon as the query changes', async () => {
    let firstSignal: AbortSignal | undefined;
    const api: ExactSearchApi = {
      search: vi.fn((_request, signal) => {
        firstSignal ??= signal;
        return new Promise<ExactSearchResult>(() => undefined);
      }),
    };
    renderSearch(api);
    const user = userEvent.setup();
    const input = screen.getByRole('combobox', { name: 'Search current workspace' });

    await user.type(input, 'alpha');
    await waitFor(() => expect(api.search).toHaveBeenCalledOnce());
    await user.type(input, ' beta');

    await waitFor(() => expect(firstSignal?.aborted).toBe(true));
  });

  it('switches to Similar mode within the selected folder and navigates by chunk anchor', async () => {
    const semanticApi: SemanticSearchApi = { search: vi.fn(async () => semanticResult) };
    const exactApi: ExactSearchApi = { search: vi.fn(async () => result) };
    const rendered = renderSearch(exactApi, { semanticApi });
    const user = userEvent.setup();

    await user.click(screen.getByRole('tab', { name: 'Similar' }));
    expect(screen.queryByRole('combobox', { name: 'Search scope' })).toBeNull();
    await user.type(screen.getByRole('combobox', { name: 'Search current workspace' }), 'answers');

    const option = await screen.findByRole('option', { name: /idea\.md, notes, Answers/u });
    expect(semanticApi.search).toHaveBeenCalledWith(
      { folderPath: '/library/research', query: 'answers', topK: 30 },
      expect.any(AbortSignal),
    );
    expect(exactApi.search).not.toHaveBeenCalled();
    expect(screen.queryByRole('group')).toBeNull();
    expect(option.querySelector('mark')).toBeNull();

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

  it('explains a missing AI Index without sending a Similar request and keeps Exact usable', async () => {
    const semanticApi: SemanticSearchApi = { search: vi.fn(async () => semanticResult) };
    const exactApi: ExactSearchApi = { search: vi.fn(async () => result) };
    const rendered = renderSearch(exactApi, {
      semanticApi,
      status: folderStatus({ available: false, enabled: false, state: 'disabled' }),
    });
    const user = userEvent.setup();

    const similarTab = screen.getByRole('tab', { name: 'Similar' });
    expect(similarTab.getAttribute('title')).toBe('Match by meaning — needs AI Index');
    await user.click(similarTab);
    await user.type(screen.getByRole('combobox', { name: 'Search current workspace' }), 'answers');

    expect(screen.getByText('Set up AI Index to search by meaning.')).not.toBeNull();
    expect(screen.getByText('Exact text search works without AI Index.')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Open Settings' }));
    expect(rendered.onOpenSettings).toHaveBeenCalledWith('ai-index');
    expect(semanticApi.search).not.toHaveBeenCalled();

    await user.click(screen.getByRole('tab', { name: 'Exact' }));
    expect(await screen.findByRole('option', { name: /answer\.md/u })).not.toBeNull();
  });

  it('offers the AI Index workload decision in both modes and forwards it folder-explicitly', async () => {
    const exactApi: ExactSearchApi = { search: vi.fn(async () => result) };
    const rendered = renderSearch(exactApi, {
      status: folderStatus({
        estimatedBytes: 2 * 1024 * 1024,
        settled: true,
        sourceCount: 40,
        state: 'awaiting-decision',
      }),
    });

    expect(screen.getByText('Large AI Index workload')).not.toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Build AI Index' }));
    await waitFor(() =>
      expect(rendered.decisions.decide).toHaveBeenCalledWith(
        '/library/research',
        'start',
        expect.any(AbortSignal),
      ),
    );
  });

  it('shows the preparation readiness line with a transcription setup action', async () => {
    const exactApi: ExactSearchApi = { search: vi.fn(async () => result) };
    const rendered = renderSearch(exactApi, {
      preparation: { blocked: 2, cancelled: 0, failed: 0, pending: 0 },
      status: folderStatus({}, { total: 9 }),
    });

    expect(screen.getByText('Transcription setup required')).not.toBeNull();
    expect(
      screen.getByText('7 files ready to search. 2 media files need transcription setup.'),
    ).not.toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Open Settings' }));
    expect(rendered.onOpenSettings).toHaveBeenCalledWith('transcription');
  });

  it('surfaces the index warning with retry and dismiss', async () => {
    const exactApi: ExactSearchApi = { search: vi.fn(async () => result) };
    const rendered = renderSearch(exactApi, {
      status: folderStatus({
        state: 'failed',
        warning: { at: 'now', message: 'daemon restarted' },
      }),
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
