import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';

import { CommandInput, CommandItem, CommandList } from './command-menu';
import { FileTypeIcon } from './file-type-icon';

const documents = [
  'design-docs/overview.md',
  'design-docs/user-journeys.md',
  'code-review/architecture.md',
  'reports/quarterly.pdf',
  'src/session-runtime.ts',
];

const meta = {
  title: 'Navigation/Command Menu',
  component: CommandList,
  subcomponents: { CommandInput, CommandItem },
  parameters: { controls: { disable: true }, fluidCanvas: { width: '30rem', minHeight: '20rem' } },
} satisfies Meta<typeof CommandList>;

export default meta;
type Story = StoryObj;

const rowId = (path: string) => `command-menu-story-${path.replaceAll('/', '-')}`;

function Search({ query: initialQuery = '' }: { query?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [activeIndex, setActiveIndex] = useState(0);
  const matches = documents.filter((path) =>
    path.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border bg-surface-3">
      <CommandInput
        // The field keeps focus while the highlight moves, so the active row
        // has to be named here or a screen reader never hears it change.
        aria-activedescendant={matches[activeIndex] ? rowId(matches[activeIndex]) : undefined}
        aria-label="Search documents"
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        // The list draws the highlight; moving it is the caller's job, which
        // is why the wiring lives in the story rather than in CommandList.
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          const step = event.key === 'ArrowDown' ? 1 : -1;
          setActiveIndex((index) =>
            Math.min(Math.max(index + step, 0), Math.max(matches.length - 1, 0)),
          );
        }}
        placeholder="Search documents…"
        shortcut="⌘K"
        value={query}
      />
      {matches.length === 0 ? (
        <p className="px-4 py-6 text-center text-body text-muted-foreground">No documents match.</p>
      ) : (
        <CommandList
          activeIndex={activeIndex}
          aria-label="Documents"
          className="max-h-64 p-1.5"
          onActiveIndexChange={setActiveIndex}
        >
          {matches.map((path) => (
            <CommandItem id={rowId(path)} key={path}>
              <FileTypeIcon
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
                path={path}
              />
              <span className="truncate">{path}</span>
            </CommandItem>
          ))}
        </CommandList>
      )}
    </div>
  );
}

/** The palette at rest: a search field with its shortcut keycap and the full
 *  result list, the first row selected. */
export const Palette: Story = { render: () => <Search /> };

/** A query that matches nothing keeps the field and explains the gap. */
export const NoMatches: Story = { render: () => <Search query="zzz" /> };

/** The palette after the keyboard has moved off the first row: the selected
 *  option and the `aria-activedescendant` pointing at it are what a screen
 *  reader follows, and neither exists in the resting story. */
export const Navigated: Story = {
  render: () => <Search />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox', { name: 'Search documents' });
    await userEvent.click(field);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await expect(canvas.getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true');
  },
};
