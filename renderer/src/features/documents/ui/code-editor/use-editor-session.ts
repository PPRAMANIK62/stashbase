import { useEffect, useRef, type RefObject } from 'react';

import type { CodeEditorSession } from './editor';

export interface CodeEditorBinding {
  /** The document text the session must show; later values are patched in. */
  content: string;
  /**
   * Builds the session once, when the host mounts. `report` is stable for the
   * life of the session and always forwards to the current `onChange`.
   */
  create(host: HTMLElement, report: (value: string) => void): CodeEditorSession;
  /** Receives every edit the reader makes in the session. */
  onChange(value: string): void;
  readOnly: boolean;
  /** The owning tab. One session lives exactly as long as one tab. */
  tabId: string;
}

/**
 * Binds one CodeMirror session to one document tab: created when the host
 * mounts, destroyed when the tab goes, and never rebuilt in between, so
 * selection and undo history survive every prop change. `content` and
 * `readOnly` are mirrored into the live session rather than recreating it, and
 * edits are forwarded through a ref so a session built at mount still reports
 * to the newest `onChange`.
 */
export function useCodeEditorSession(binding: CodeEditorBinding): {
  hostRef: RefObject<HTMLDivElement | null>;
  sessionRef: RefObject<CodeEditorSession | null>;
} {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<CodeEditorSession | null>(null);
  const latestRef = useRef(binding);
  latestRef.current = binding;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const session = latestRef.current.create(host, (value) => latestRef.current.onChange(value));
    sessionRef.current = session;
    return () => {
      if (sessionRef.current === session) sessionRef.current = null;
      session.destroy();
    };
  }, [binding.tabId]);

  useEffect(() => {
    sessionRef.current?.setReadOnly(binding.readOnly);
  }, [binding.readOnly]);

  useEffect(() => {
    sessionRef.current?.applyContent(binding.content);
  }, [binding.content]);

  return { hostRef, sessionRef };
}
