import assert from 'node:assert/strict';
import test from 'node:test';

import { renderMarkdown } from '../../markdown.ts';

test('document renderer removes executable and navigation-breaking HTML', () => {
  const document = renderMarkdown(`
<script>alert('script')</script>
<style>body { display: none }</style>
<iframe src="https://example.com"></iframe>
<object data="https://example.com/payload"></object>
<embed src="https://example.com/payload">
<base href="https://example.com/">
<meta http-equiv="refresh" content="0;url=https://example.com">
<form action="https://example.com"><button type="submit">Leave</button></form>
<a href="javascript:alert('link')" target="_top" onclick="alert('click')">unsafe link</a>
<a href="file:///etc/passwd">unsafe file</a>
<p style="position:fixed" onmouseover="alert('hover')">styled text</p>
<img src="javascript:alert('image')" onerror="alert('image error')">
<img src="data:text/html,<script>alert('data')</script>">
<img src="blob:https://example.com/unsafe">
`);

  const body = document.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? '';
  assert.doesNotMatch(body, /<(?:script|style|iframe|object|embed|base|form|button)\b/i);
  assert.doesNotMatch(body, /<meta\b[^>]*http-equiv/i);
  assert.doesNotMatch(body, /\s(?:onerror|onclick|onmouseover|style|target)=/i);
  assert.doesNotMatch(body, /(?:javascript:|file:|data:|blob:)/i);
  assert.match(body, />unsafe link<\/a>/);
  assert.match(body, />unsafe file<\/a>/);
  assert.match(body, /<img\s*\/>|<img>/);
});

test('document renderer preserves ordinary HTML and safe URLs', () => {
  const document = renderMarkdown(`
# Document

| Name | Value |
| --- | --- |
| One | Two |

<details open><summary>More</summary><p>Use <kbd>Cmd</kbd> + <mark>K</mark>, H<sub>2</sub>O, and x<sup>2</sup>.</p></details>

[Relative note](other.md#section)

![Relative image](images/example.png)

- [x] Complete
`);

  assert.match(document, /<h1 id="document">Document<\/h1>/);
  assert.match(document, /<table>/);
  assert.match(document, /<details open(?:="")?><summary>More<\/summary>/);
  assert.match(document, /<kbd>Cmd<\/kbd>/);
  assert.match(document, /<mark>K<\/mark>/);
  assert.match(document, /H<sub>2<\/sub>O/);
  assert.match(document, /x<sup>2<\/sup>/);
  assert.match(document, /href="other\.md#section"/);
  assert.match(document, /src="images\/example\.png"/);
});
