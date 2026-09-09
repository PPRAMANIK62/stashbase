import { cleanup, render, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { mergeRefs, useMergedRef } from './merge-refs';

afterEach(cleanup);

describe('mergeRefs', () => {
  it('fans one node out to every kind of ref, and clears them the legacy way', () => {
    const seen: (HTMLDivElement | null)[] = [];
    const object = createRef<HTMLDivElement>();
    const merged = mergeRefs<HTMLDivElement>((node) => void seen.push(node), object, undefined);
    const node = document.createElement('div');

    // React 19 treats a returned function as a cleanup; returning nothing keeps
    // the detach path a second call with `null`.
    expect(merged(node)).toBeUndefined();
    expect(seen).toEqual([node]);
    expect(object.current).toBe(node);

    merged(null);
    expect(seen).toEqual([node, null]);
    expect(object.current).toBeNull();
  });
});

describe('useMergedRef', () => {
  it('holds its identity while both inputs are stable', () => {
    const own = createRef<HTMLDivElement>();
    const forwarded = createRef<HTMLDivElement>();
    const replacement = createRef<HTMLDivElement>();
    const { result, rerender } = renderHook(
      ({ caller }) => useMergedRef<HTMLDivElement>(own, caller),
      { initialProps: { caller: forwarded } },
    );

    const first = result.current;
    rerender({ caller: forwarded });
    expect(result.current).toBe(first);
    rerender({ caller: replacement });
    expect(result.current).not.toBe(first);
  });

  it('attaches a node once across re-renders, and detaches on unmount', () => {
    const attachments: (HTMLDivElement | null)[] = [];
    const own = createRef<HTMLDivElement>();
    const forwarded = (node: HTMLDivElement | null) => void attachments.push(node);

    function Box({ label }: { label: string }) {
      return <div ref={useMergedRef<HTMLDivElement>(own, forwarded)}>{label}</div>;
    }

    const view = render(<Box label="first" />);
    expect(attachments).toEqual([own.current]);
    expect(own.current?.textContent).toBe('first');

    // A fresh callback ref would make React detach and re-attach here, and any
    // layout effect running in that window would read a null ref.
    view.rerender(<Box label="second" />);
    expect(attachments).toHaveLength(1);

    view.unmount();
    expect(attachments).toHaveLength(2);
    expect(attachments[1]).toBeNull();
    expect(own.current).toBeNull();
  });
});
