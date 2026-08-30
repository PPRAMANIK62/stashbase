import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vite-plus/test';

import { App } from './app';

const foundationCss = fs.readFileSync(path.resolve(process.cwd(), 'src/foundation.css'), 'utf8');
const browserEntry = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

describe('replacement foundation', () => {
  it('identifies the isolated renderer with one semantic main landmark', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('<main');
    expect(markup).toContain('data-foundation="renderer"');
    expect(markup).toContain('min-h-screen');
    expect(markup).toContain('Replacement renderer · foundation active');
    expect(markup.match(/<main/g)).toHaveLength(1);
  });

  it('starts production with bounded system appearance defaults', () => {
    expect(browserEntry).toContain('data-theme="system"');
    expect(browserEntry).toContain('data-ui-scale="default"');
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

describe('replacement environment policy', () => {
  it('uses Tailwind and preserves real operating-system media behavior', () => {
    expect(foundationCss).toContain("@import 'tailwindcss'");
    expect(foundationCss).toContain('@media (prefers-color-scheme: dark)');
    expect(foundationCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(foundationCss).toContain('@media (forced-colors: active)');
  });

  it('defines every bounded interface-scale state', () => {
    for (const scale of ['small', 'large']) {
      expect(foundationCss).toContain(`:root[data-ui-scale='${scale}']`);
    }
  });
});
