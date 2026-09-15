import { describe, expect, it } from 'vite-plus/test';

import { retainMarkdownTabIds, splitLeadingYamlFrontmatter } from './markdown';

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

  it('drops closed documents and leaves non-Markdown viewers to their own sessions', () => {
    const tabs = [
      { id: 'markdown', source: { path: 'plan.markdown' } },
      { id: 'text', source: { path: 'notes.txt' } },
    ];

    expect(retainMarkdownTabIds(['missing', 'text'], tabs, 'text')).toEqual([]);
    expect(retainMarkdownTabIds([], tabs, 'markdown')).toEqual(['markdown']);
  });
});
