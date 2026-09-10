import { describe, expect, it } from 'vite-plus/test';

import { matchingJsonTreeNodes } from './json-search';
import { analyzeJsonSource } from './json-source';

describe('JSON tree search', () => {
  it('shares case and whole-word matching semantics with document Find', () => {
    const result = analyzeJsonSource('{"Alpha":"alpha_beta","other":"alpha"}');
    expect(result.available).toBe(true);
    if (!result.available) return;

    expect(
      matchingJsonTreeNodes(result.root, 'Alpha', {
        caseSensitive: true,
        wholeWord: true,
      }).map((node) => node.path),
    ).toEqual([['Alpha']]);
    expect(
      matchingJsonTreeNodes(result.root, 'alpha', {
        caseSensitive: true,
        wholeWord: true,
      }).map((node) => node.path),
    ).toEqual([['other']]);
    expect(
      matchingJsonTreeNodes(result.root, 'alpha', {
        caseSensitive: false,
        wholeWord: false,
      }).map((node) => node.path),
    ).toEqual([['Alpha'], ['other']]);
  });

  it('folds case the same way in every locale', () => {
    // `İ`.toLocaleLowerCase() answers `i̇` under a Turkish locale and `i̇`
    // (i + combining dot) elsewhere, so a locale-aware fold would make this
    // search depend on the reader's language. Case folding for a search is
    // invariant.
    const result = analyzeJsonSource('{"title":"DIVIDER"}');
    expect(result.available).toBe(true);
    if (!result.available) return;

    expect(
      matchingJsonTreeNodes(result.root, 'divider', {
        caseSensitive: false,
        wholeWord: false,
      }).map((node) => node.path),
    ).toEqual([['title']]);
    expect(
      matchingJsonTreeNodes(result.root, 'İ', { caseSensitive: false, wholeWord: false }),
    ).toEqual([]);
  });
});
