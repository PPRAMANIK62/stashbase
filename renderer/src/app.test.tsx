import fs from 'node:fs';
import path from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vite-plus/test';

import { App } from './app';

const globalCss = fs.readFileSync(path.resolve(process.cwd(), 'src/globals.css'), 'utf8');
const shadcnConfig = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'components.json'), 'utf8'),
) as {
  style: string;
  tailwind: { baseColor: string; css: string; cssVariables: boolean };
};
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
  it('keeps every OKLCH token monochrome', () => {
    const chromaValues = [...globalCss.matchAll(/oklch\(\s*[\d.]+\s+([\d.]+)/gi)].map(
      ([, chroma]) => Number(chroma),
    );

    expect(chromaValues.length).toBeGreaterThan(0);
    for (const chroma of chromaValues) {
      expect(chroma).toBe(0);
    }
  });
});

describe('replacement environment policy', () => {
  it('uses the shadcn Tailwind v4 entry and semantic token convention', () => {
    expect(globalCss).toContain("@import 'tailwindcss'");
    expect(globalCss).toContain("@import 'shadcn/tailwind.css'");
    expect(globalCss).toContain('@theme inline');
    expect(globalCss).toContain('--color-background: var(--background)');
    expect(globalCss).toContain('--color-sidebar: var(--sidebar)');
  });

  it('preserves real operating-system media behavior', () => {
    expect(globalCss).toContain('@media (prefers-color-scheme: dark)');
    expect(globalCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(globalCss).toContain('@media (forced-colors: active)');
  });

  it('defines every bounded interface-scale state', () => {
    for (const scale of ['small', 'large']) {
      expect(globalCss).toContain(`:root[data-ui-scale='${scale}']`);
    }
  });

  it('routes the Base UI shadcn registry to the renderer globals entry', () => {
    expect(shadcnConfig).toMatchObject({
      style: 'base-nova',
      tailwind: {
        baseColor: 'neutral',
        css: 'src/globals.css',
        cssVariables: true,
      },
    });
  });
});
