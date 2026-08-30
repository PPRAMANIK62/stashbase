import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vite-plus/test';

import { App } from './app';

const foundationCss = fs.readFileSync(path.resolve(process.cwd(), 'src/foundation.css'), 'utf8');

describe('replacement foundation', () => {
  it('identifies the isolated renderer with one semantic main landmark', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('<main');
    expect(markup).toContain('data-foundation="web-next"');
    expect(markup).toContain('Replacement renderer · foundation active');
    expect(markup.match(/<main/g)).toHaveLength(1);
  });
});

describe('replacement color policy', () => {
  it('keeps every foundation hex value monochrome', () => {
    const colors = [...foundationCss.matchAll(/#([\da-f]{2})([\da-f]{2})([\da-f]{2})/gi)];

    expect(colors.length).toBeGreaterThan(0);
    for (const [, red, green, blue] of colors) {
      expect(new Set([red, green, blue]).size).toBe(1);
    }
  });
});
