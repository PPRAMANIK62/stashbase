import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import type { DocumentFindController } from '@/features/documents/application/navigation-runtime';

import type { CodeEditorSession } from './editor';
import { useCodeEditorSession } from './use-editor-session';

afterEach(cleanup);

const inertFind: DocumentFindController = {
  close: () => undefined,
  next: () => ({ current: 0, total: 0 }),
  previous: () => ({ current: 0, total: 0 }),
  setQuery: () => ({ current: 0, total: 0 }),
};

interface FakeSession {
  applied: string[];
  content: string;
  destroyed: boolean;
  readOnly: boolean[];
  report(value: string): void;
}

function harness() {
  const sessions: FakeSession[] = [];
  const edits: string[] = [];

  function Harness({
    content,
    onChange,
    readOnly,
    tabId,
  }: {
    content: string;
    onChange(value: string): void;
    readOnly: boolean;
    tabId: string;
  }) {
    const { hostRef } = useCodeEditorSession({
      content,
      create: (_host, report) => {
        const session: FakeSession = {
          applied: [],
          content,
          destroyed: false,
          readOnly: [],
          report,
        };
        sessions.push(session);
        const handle: CodeEditorSession = {
          applyContent: (next) => {
            session.applied.push(next);
          },
          destroy: () => {
            session.destroyed = true;
          },
          find: inertFind,
          focus: () => undefined,
          setReadOnly: (next) => {
            session.readOnly.push(next);
          },
        };
        return handle;
      },
      onChange,
      readOnly,
      tabId,
    });
    return <div ref={hostRef} />;
  }

  return { edits, Harness, sessions };
}

describe('code editor session binding', () => {
  it('builds one session per tab and mirrors later props into it', () => {
    const { Harness, sessions } = harness();
    const view = render(
      <Harness content="first" onChange={() => undefined} readOnly tabId="notes.txt" />,
    );

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.content).toBe('first');

    view.rerender(
      <Harness content="second" onChange={() => undefined} readOnly={false} tabId="notes.txt" />,
    );

    expect(sessions).toHaveLength(1);
    // The content mirror also runs at mount; a real session ignores a patch
    // that matches what it already shows.
    expect(sessions[0]?.applied).toEqual(['first', 'second']);
    expect(sessions[0]?.readOnly).toEqual([true, false]);
    expect(sessions[0]?.destroyed).toBe(false);
  });

  it('retires the session when the tab changes and when the surface unmounts', () => {
    const { Harness, sessions } = harness();
    const view = render(
      <Harness content="first" onChange={() => undefined} readOnly={false} tabId="notes.txt" />,
    );

    view.rerender(
      <Harness content="other" onChange={() => undefined} readOnly={false} tabId="other.txt" />,
    );

    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.destroyed).toBe(true);
    expect(sessions[1]?.content).toBe('other');
    expect(sessions[1]?.applied).toEqual(['other']);

    view.unmount();
    expect(sessions[1]?.destroyed).toBe(true);
  });

  it('reports edits to the newest handler, not the one captured at mount', () => {
    const { edits, Harness, sessions } = harness();
    const view = render(
      <Harness
        content="first"
        onChange={(value) => edits.push(`stale:${value}`)}
        readOnly={false}
        tabId="notes.txt"
      />,
    );

    view.rerender(
      <Harness
        content="first"
        onChange={(value) => edits.push(`live:${value}`)}
        readOnly={false}
        tabId="notes.txt"
      />,
    );
    sessions[0]?.report('edited');

    expect(edits).toEqual(['live:edited']);
  });
});
