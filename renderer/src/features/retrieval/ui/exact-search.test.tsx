import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type { ExactSearchApi } from '@/features/retrieval/application/ports';
import type { ExactSearchResult } from '@/features/retrieval/domain/exact-search';

import { ExactSearch } from './exact-search';

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
      source: { folderPath: '/library/archive', path: 'notes/answer.md' },
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

function renderSearch(api: ExactSearchApi, onNavigate = vi.fn(async () => true)) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <ExactSearch
        active
        activeFolderPath="/library/research"
        api={api}
        focusRevision={0}
        onNavigate={onNavigate}
        scopes={[
          { folderPath: '/library/research', label: 'Research' },
          { folderPath: '/library/archive', label: 'Archive' },
        ]}
      />
    </QueryClientProvider>,
  );
  return { ...rendered, onNavigate, queryClient };
}

describe('Exact Search', () => {
  it('searches the active folder by default and presents occurrence evidence', async () => {
    const api: ExactSearchApi = { search: vi.fn(async () => result) };
    const rendered = renderSearch(api);
    const input = screen.getByRole('combobox', { name: 'Search library' });

    await userEvent.setup().type(input, 'answer');

    const option = await screen.findByRole('option', {
      name: /answer\.md, Archive, notes, Line 7, The answer is preserved here\., read-only/u,
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
    expect(screen.getByText(/Archive.*Read-only/u)).not.toBeNull();
    expect(screen.getByText('2')).not.toBeNull();
    expect(screen.getByText(/Showing the first results from 2 matches/u)).not.toBeNull();

    await userEvent.setup().keyboard('{Enter}');
    await waitFor(() =>
      expect(rendered.onNavigate).toHaveBeenCalledWith({
        source: { folderPath: '/library/archive', path: 'notes/answer.md' },
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

  it('narrows the request to a selected member folder', async () => {
    const api: ExactSearchApi = { search: vi.fn(async () => ({ ...result, truncated: false })) };
    renderSearch(api);
    const user = userEvent.setup();

    await user.click(screen.getByRole('combobox', { name: 'Search scope' }));
    await user.click(await screen.findByRole('option', { name: 'Archive' }));
    await user.type(screen.getByRole('combobox', { name: 'Search library' }), 'answer');

    await waitFor(() =>
      expect(api.search).toHaveBeenCalledWith(
        {
          caseSensitive: false,
          folderPath: '/library/archive',
          query: 'answer',
          wholeWord: false,
        },
        expect.any(AbortSignal),
      ),
    );
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

    await user.type(screen.getByRole('combobox', { name: 'Search library' }), 'answer');
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
    const input = screen.getByRole('combobox', { name: 'Search library' });
    const elsewhere = globalThis.document.createElement('button');
    globalThis.document.body.append(elsewhere);
    elsewhere.focus();

    rendered.rerender(
      <QueryClientProvider client={rendered.queryClient}>
        <ExactSearch
          active
          activeFolderPath="/library/research"
          api={api}
          focusRevision={1}
          onNavigate={rendered.onNavigate}
          scopes={[
            { folderPath: '/library/research', label: 'Research' },
            { folderPath: '/library/archive', label: 'Archive' },
          ]}
        />
      </QueryClientProvider>,
    );

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
    const input = screen.getByRole('combobox', { name: 'Search library' });

    await user.type(input, 'alpha');
    await waitFor(() => expect(api.search).toHaveBeenCalledOnce());
    await user.type(input, ' beta');

    await waitFor(() => expect(firstSignal?.aborted).toBe(true));
  });
});
