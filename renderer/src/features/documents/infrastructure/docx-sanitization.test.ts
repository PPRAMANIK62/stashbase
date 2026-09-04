import { describe, expect, it } from 'vite-plus/test';

import { sanitizeDocxHtml } from '@/shared/html-sanitization';

describe('DOCX preview sanitization', () => {
  it('keeps document structure and safe embedded images while removing executable content', () => {
    const html = sanitizeDocxHtml(`
      <h1 onclick="alert('x')">Report</h1>
      <script>globalThis.compromised = true</script>
      <a href="javascript:alert('x')">Unsafe</a>
      <img src="data:text/html;base64,PHNjcmlwdD4=" alt="bad">
      <img src="data:image/png;base64,aGVsbG8=" alt="chart">
    `);

    expect(html).toContain('<h1>Report</h1>');
    expect(html).toContain('data:image/png;base64,aGVsbG8=');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('data:text/html');
  });
});
