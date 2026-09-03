import { useEffect, useMemo, useRef } from 'react';
import { useStore } from 'zustand';

import type { DocumentRuntime } from '@/features/documents/application/document-runtime';
import type {
  DocumentFindController,
  DocumentNavigationRuntime,
  FindMatchInfo,
  FindOptions,
} from '@/features/documents/application/navigation-runtime';
import type { JsonDocumentSession } from '@/features/documents/domain/document';
import {
  analyzeJsonSource,
  formatJsonPath,
  matchingJsonTreeNodes,
  type JsonTreeAnalysis,
  type JsonSourceNode,
} from '@/features/documents/domain/json-source';

import { createJsonSourceEditor, type JsonSourceEditorSession } from './source-editor';
import { JsonTree } from './tree';

export interface JsonDocumentProps {
  active: boolean;
  name: string;
  navigation: DocumentNavigationRuntime;
  onChange(value: string): void;
  readOnly: boolean;
  runtime: DocumentRuntime;
  value: string;
}

export function JsonDocument({
  active,
  name,
  navigation,
  onChange,
  readOnly,
  runtime,
  value,
}: JsonDocumentProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<JsonSourceEditorSession | null>(null);
  const valueRef = useRef(value);
  const sessionRef = useRef<JsonDocumentSession>(runtime.store.getState().jsonSession);
  const registrationOwnerRef = useRef(Symbol(runtime.scope.id));
  const session = useStore(runtime.store, (state) => state.jsonSession);
  const analysis = useMemo(() => analyzeJsonSource(value), [value]);
  const activePane =
    session.viewMode === 'tree' && !analysis.available
      ? 'source'
      : (session.viewMode ?? (analysis.available ? 'tree' : 'source'));
  valueRef.current = value;
  sessionRef.current = session;

  useEffect(() => {
    if (session.viewMode !== activePane) runtime.setJsonSession({ viewMode: activePane });
  }, [activePane, runtime, session.viewMode]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const editor = createJsonSourceEditor(host, {
      content: valueRef.current,
      onChange,
      readOnly,
    });
    editorRef.current = editor;
    return () => {
      if (editorRef.current === editor) editorRef.current = null;
      editor.destroy();
    };
    // The document runtime owns the tab lifetime; one editor instance keeps
    // selection and undo history while this JSON surface is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime.scope.id]);

  useEffect(() => editorRef.current?.setReadOnly(readOnly), [readOnly]);

  useEffect(() => {
    editorRef.current?.applySourcePatch(value);
  }, [value]);

  const treeFindRef = useRef<DocumentFindController | null>(null);
  if (!treeFindRef.current) {
    treeFindRef.current = createJsonTreeFindController(
      () => valueRef.current,
      () => sessionRef.current,
      (patch) => runtime.setJsonSession(patch),
      () => rootRef.current,
    );
  }

  useEffect(() => {
    if (!active) return;
    const controller = activePane === 'tree' ? treeFindRef.current : editorRef.current?.find;
    if (!controller) return;
    return navigation.claimFind(runtime.scope.id, registrationOwnerRef.current, controller);
  }, [active, activePane, navigation, runtime.scope.id]);

  const activatePane = (pane: 'source' | 'tree') => {
    if (pane === 'tree' && !analysis.available) return;
    if (pane !== activePane) runtime.setJsonSession({ viewMode: pane });
  };
  const applyTreeChange = (next: string) => {
    editorRef.current?.applySourcePatch(next);
    onChange(next);
  };

  return (
    <div
      aria-label={`${name} JSON content`}
      className="flex size-full min-h-0 flex-col bg-surface-2"
      data-json-active-pane={activePane}
      ref={rootRef}
      role="document"
    >
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <JsonTree
          active={activePane === 'tree'}
          editable={!readOnly}
          onChange={applyTreeChange}
          onActivate={() => activatePane('tree')}
          onSessionChange={(patch) => runtime.setJsonSession(patch)}
          session={session}
          source={value}
        />

        <section
          aria-label="JSON source"
          className="flex min-h-0 min-w-0 flex-col border-l border-border bg-surface-2"
          data-active={activePane === 'source' ? '' : undefined}
          onFocusCapture={() => activatePane('source')}
          onPointerDown={() => activatePane('source')}
        >
          <div className="flex h-9 shrink-0 items-center gap-2 px-3">
            <span className="text-caption font-medium text-muted-foreground">Source</span>
            {!analysis.available && (
              <span
                className="min-w-0 truncate text-caption text-destructive"
                role="status"
                title={analysis.message}
              >
                {sourceIssueLabel(analysis)}
              </span>
            )}
          </div>
          <div className="min-h-0 flex-1" ref={hostRef} />
        </section>
      </div>
    </div>
  );
}

function sourceIssueLabel(analysis: Extract<JsonTreeAnalysis, { available: false }>): string {
  switch (analysis.reason) {
    case 'invalid':
      return analysis.location
        ? `Invalid JSON · line ${analysis.location.line}, column ${analysis.location.column}`
        : 'Invalid JSON';
    case 'empty':
      return 'Add a JSON value';
    case 'duplicate-keys':
      return 'Tree unavailable · duplicate keys';
    case 'over-limit':
      return 'Tree unavailable · source is too complex';
  }
}

export function createJsonTreeFindController(
  getSource: () => string,
  getSession: () => JsonDocumentSession,
  setSession: (patch: Partial<JsonDocumentSession>) => void,
  getRoot: () => HTMLElement | null = () => null,
): DocumentFindController {
  let matches: JsonSourceNode[] = [];
  let cursor = -1;
  let options: FindOptions = { caseSensitive: false, wholeWord: false };
  let query = '';
  const report = (): FindMatchInfo => ({
    current: cursor < 0 ? 0 : cursor + 1,
    total: matches.length,
  });
  const select = (node: JsonSourceNode | undefined, scroll = true) => {
    if (!node) return;
    const expanded = new Set(getSession().expandedPaths);
    for (let length = 0; length < node.path.length; length += 1) {
      expanded.add(formatJsonPath(node.path.slice(0, length)));
    }
    setSession({
      expandedPaths: [...expanded],
      search: query,
      searchOptions: options,
      selectedPath: formatJsonPath(node.path),
    });
    if (scroll) {
      queueMicrotask(() => {
        const selected = getRoot()?.querySelector<HTMLElement>(
          '[data-json-tree] [data-json-node-row][aria-selected="true"]',
        );
        selected?.scrollIntoView({ block: 'nearest' });
      });
    }
  };
  const recompute = (preserveSelection: boolean, scroll: boolean) => {
    const analysis = analyzeJsonSource(getSource());
    const previousPath = matches[cursor] ? formatJsonPath(matches[cursor].path) : null;
    matches =
      analysis.available && query ? matchingJsonTreeNodes(analysis.root, query, options) : [];
    cursor =
      matches.length === 0
        ? -1
        : preserveSelection && previousPath
          ? Math.max(
              0,
              matches.findIndex((node) => formatJsonPath(node.path) === previousPath),
            )
          : 0;
    setSession({ search: query, searchOptions: options });
    select(matches[cursor], scroll);
    return report();
  };
  const step = (direction: 1 | -1) => {
    recompute(true, false);
    if (!matches.length) return report();
    cursor = (cursor + direction + matches.length) % matches.length;
    select(matches[cursor]);
    return report();
  };

  return {
    close() {
      cursor = -1;
      matches = [];
      query = '';
      setSession({ search: '' });
    },
    next: () => step(1),
    previous: () => step(-1),
    restoreQuery(nextQuery, nextOptions) {
      query = nextQuery;
      options = nextOptions;
      return recompute(true, false);
    },
    setQuery(nextQuery, nextOptions) {
      query = nextQuery;
      options = nextOptions;
      return recompute(false, true);
    },
  };
}
