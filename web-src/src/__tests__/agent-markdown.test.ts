import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AgentMarkdown, isHttpUrl, localAssistantLinkPath } from '../components/agent/AgentMarkdown.tsx';

test('agent Markdown keeps GFM content but renders raw HTML as text', () => {
  const html = renderToStaticMarkup(
    createElement(AgentMarkdown, { markdown: '- [x] done\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n<script>alert(1)</script>', onOpenArtifact: () => {} }),
  );

  assert.match(html, /type="checkbox"/);
  assert.match(html, /<table>/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('agent Markdown link policy only opens local files and HTTP(S) URLs', () => {
  assert.equal(localAssistantLinkPath('notes/hello%20world.md'), 'notes/hello world.md');
  assert.equal(localAssistantLinkPath('#heading'), null);
  assert.equal(localAssistantLinkPath('javascript:alert(1)'), null);
  assert.equal(localAssistantLinkPath('//example.com/file.md'), null);
  assert.equal(isHttpUrl('https://example.com'), true);
  assert.equal(isHttpUrl('javascript:alert(1)'), false);

  const html = renderToStaticMarkup(
    createElement(AgentMarkdown, { markdown: '[local](notes/a.md) [bad](javascript:alert(1)) ![remote](https://example.com/a.png)', onOpenArtifact: () => {} }),
  );
  assert.match(html, /href="notes\/a.md"/);
  assert.doesNotMatch(html, /javascript:|<img/);
});
