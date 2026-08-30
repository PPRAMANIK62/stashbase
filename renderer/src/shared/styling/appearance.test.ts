import { beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  applyRendererAppearance,
  defaultRendererAppearance,
  resolveRendererAppearance,
} from './appearance';

describe('renderer appearance', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-ui-scale');
  });

  it('applies bounded production appearance values to the document root', () => {
    applyRendererAppearance(document.documentElement, {
      theme: 'dark',
      interfaceScale: 'large',
    });

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.uiScale).toBe('large');
  });

  it('falls back safely when workbench controls provide unknown values', () => {
    expect(resolveRendererAppearance('sepia', 'huge')).toEqual(defaultRendererAppearance);
  });
});
