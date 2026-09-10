import { describe, expect, it } from 'vite-plus/test';

import {
  MAX_RETAINED_MARKDOWN_SURFACES,
  retainMarkdownTabIds,
  splitLeadingYamlFrontmatter,
} from './markdown';

describe('Markdown document policy', () => {
  it('keeps valid leading YAML verbatim and leaves malformed metadata in the document body', () => {
    expect(splitLeadingYamlFrontmatter('---\ntitle: Plan\n---\n# Body')).toEqual({
      body: '# Body',
      source: '---\ntitle: Plan\n---\n',
    });
    expect(splitLeadingYamlFrontmatter('---\ntitle: [broken\n---\n# Body')).toEqual({
      body: '---\ntitle: [broken\n---\n# Body',
      source: '',
    });
  });

  it('retains only the five most recently activated Markdown surfaces', () => {
    const tabs = Array.from({ length: 7 }, (_, index) => ({
      id: `tab-${index + 1}`,
      source: { path: `note-${index + 1}.md` },
    }));
    let retained: string[] = [];
    for (const tab of tabs) retained = retainMarkdownTabIds(retained, tabs, tab.id);

    expect(retained).toEqual(['tab-7', 'tab-6', 'tab-5', 'tab-4', 'tab-3']);
    expect(retained).toHaveLength(MAX_RETAINED_MARKDOWN_SURFACES);
    expect(retainMarkdownTabIds(retained, tabs.slice(0, 6), 'tab-2')).toEqual([
      'tab-2',
      'tab-6',
      'tab-5',
      'tab-4',
      'tab-3',
    ]);
  });

  it('does not spend retained-editor capacity on non-Markdown tabs', () => {
    const tabs = [
      { id: 'markdown', source: { path: 'plan.markdown' } },
      { id: 'text', source: { path: 'notes.txt' } },
    ];

    expect(retainMarkdownTabIds(['missing', 'text'], tabs, 'text')).toEqual([]);
    expect(retainMarkdownTabIds([], tabs, 'markdown')).toEqual(['markdown']);
  });
});
