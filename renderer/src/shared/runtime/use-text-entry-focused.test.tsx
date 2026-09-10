import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { useTextEntryFocused } from './use-text-entry-focused';

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

/** A region carrying the marker, holding one field of the given kind. */
function region(field: HTMLElement): HTMLElement {
  const host = document.createElement('div');
  host.dataset.region = '';
  host.append(field);
  document.body.append(host);
  return host;
}

function textarea(): HTMLTextAreaElement {
  return document.createElement('textarea');
}

function editable(): HTMLElement {
  const host = document.createElement('div');
  host.setAttribute('contenteditable', 'true');
  host.tabIndex = 0;
  return host;
}

const focus = (element: HTMLElement) => act(() => element.focus());

describe('useTextEntryFocused', () => {
  it('starts false while nothing is focused', () => {
    const { result } = renderHook(() => useTextEntryFocused('[data-region]'));

    expect(result.current).toBe(false);
  });

  it('reports a textarea inside the region', () => {
    const field = textarea();
    region(field);
    const { result } = renderHook(() => useTextEntryFocused('[data-region]'));

    focus(field);

    expect(result.current).toBe(true);
  });

  it('reports a contenteditable composer inside the region', () => {
    const field = editable();
    region(field);
    const { result } = renderHook(() => useTextEntryFocused('[data-region]'));

    focus(field);

    expect(result.current).toBe(true);
  });

  it('ignores a field outside the region', () => {
    const outside = textarea();
    document.body.append(outside);
    const { result } = renderHook(() => useTextEntryFocused('[data-region]'));

    focus(outside);

    expect(result.current).toBe(false);
  });

  it('ignores a button inside the region', () => {
    const button = document.createElement('button');
    region(button);
    const { result } = renderHook(() => useTextEntryFocused('[data-region]'));

    focus(button);

    expect(result.current).toBe(false);
  });

  it('goes back to false when focus leaves the field', () => {
    const field = textarea();
    region(field);
    const { result } = renderHook(() => useTextEntryFocused('[data-region]'));

    focus(field);
    act(() => field.blur());

    expect(result.current).toBe(false);
  });
});
