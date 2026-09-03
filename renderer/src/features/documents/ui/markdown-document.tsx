import { languages } from '@codemirror/language-data';
import { CrepeBuilder } from '@milkdown/crepe/builder';
import { blockEdit } from '@milkdown/crepe/feature/block-edit';
import { codeMirror } from '@milkdown/crepe/feature/code-mirror';
import { cursor } from '@milkdown/crepe/feature/cursor';
import { latex } from '@milkdown/crepe/feature/latex';
import { linkTooltip } from '@milkdown/crepe/feature/link-tooltip';
import { listItem } from '@milkdown/crepe/feature/list-item';
import { placeholder } from '@milkdown/crepe/feature/placeholder';
import { table } from '@milkdown/crepe/feature/table';
import { toolbar } from '@milkdown/crepe/feature/toolbar';
import { replaceAll } from '@milkdown/kit/utils';
import { BookOpen, PenLine, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { TabsSubtle, TabsSubtleItem } from '@/components/ui/tabs-subtle';
import { startMarkdownEditorCreation } from '@/features/documents/application/markdown-editor-lifecycle';
import type { MarkdownViewMode } from '@/features/documents/domain/document';
import { splitLeadingYamlFrontmatter } from '@/features/documents/domain/markdown';
import { cn } from '@/lib/utils';

import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import './markdown-document.css';

type CreationState = 'creating' | 'failed' | 'ready';

export interface MarkdownDocumentProps {
  canChangeMode: boolean;
  dirty: boolean;
  mode: MarkdownViewMode;
  name: string;
  onChange(value: string): void;
  onModeChange(mode: MarkdownViewMode): void;
  readOnly: boolean;
  value: string;
}

/** One retained Milkdown model whose editable boundary changes in place. */
export function MarkdownDocument({
  canChangeMode,
  dirty,
  mode,
  name,
  onChange,
  onModeChange,
  readOnly,
  value,
}: MarkdownDocumentProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<CrepeBuilder | null>(null);
  const onChangeRef = useRef(onChange);
  const readOnlyRef = useRef(readOnly);
  const valueRef = useRef(value);
  const observedValueRef = useRef(value);
  const frontmatterRef = useRef(splitLeadingYamlFrontmatter(value).source);
  const suppressChangeRef = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [creationState, setCreationState] = useState<CreationState>('creating');
  onChangeRef.current = onChange;
  readOnlyRef.current = readOnly;
  valueRef.current = value;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren();
    setCreationState('creating');
    const initial = splitLeadingYamlFrontmatter(valueRef.current);
    frontmatterRef.current = initial.source;
    observedValueRef.current = valueRef.current;

    const editor = new CrepeBuilder({ root: host, defaultValue: initial.body })
      .addFeature(placeholder, { mode: 'block', text: 'Start writing… or type /' })
      .addFeature(cursor)
      .addFeature(listItem)
      .addFeature(linkTooltip, {
        inputPlaceholder: 'Paste a URL or note path…',
        onCopyLink: (href) => void navigator.clipboard?.writeText(href),
      })
      .addFeature(blockEdit)
      .addFeature(toolbar)
      .addFeature(table)
      .addFeature(codeMirror, { copyText: 'Copy code', languages })
      .addFeature(latex);
    editor.setReadonly(readOnlyRef.current);
    editor.on((listener) =>
      listener.markdownUpdated((_context, markdown, previous) => {
        if (readOnlyRef.current || suppressChangeRef.current || markdown === previous) {
          return;
        }
        onChangeRef.current(frontmatterRef.current + markdown);
      }),
    );

    const stopCreation = startMarkdownEditorCreation(editor, {
      failed: () => setCreationState('failed'),
      ready: () => {
        editorRef.current = editor;
        editor.setReadonly(readOnlyRef.current);
        setCreationState('ready');
      },
    });

    return () => {
      if (editorRef.current === editor) editorRef.current = null;
      stopCreation();
    };
  }, [attempt, name]);

  useEffect(() => {
    editorRef.current?.setReadonly(readOnly);
  }, [readOnly]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || creationState !== 'ready' || dirty || observedValueRef.current === value) return;
    observedValueRef.current = value;
    const incoming = splitLeadingYamlFrontmatter(value);
    frontmatterRef.current = incoming.source;
    if (editor.getMarkdown() === incoming.body) return;
    suppressChangeRef.current = true;
    editor.editor.action(replaceAll(incoming.body));
    queueMicrotask(() => {
      suppressChangeRef.current = false;
    });
  }, [creationState, dirty, value]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const preventUnownedNavigation = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest('a')) event.preventDefault();
    };
    host.addEventListener('click', preventUnownedNavigation);
    return () => host.removeEventListener('click', preventUnownedNavigation);
  }, []);

  return (
    <div
      aria-label={`${name} Markdown content`}
      className="markdown-surface"
      data-markdown-state={creationState}
      data-read-only={readOnly || undefined}
      role="document"
    >
      {canChangeMode && (
        <TabsSubtle
          aria-label="Markdown mode"
          className="markdown-mode-control"
          iconOnly
          onSelect={(index) => onModeChange(index === 0 ? 'writer' : 'reading')}
          selectedIndex={mode === 'writer' ? 0 : 1}
          size="compact"
        >
          <TabsSubtleItem icon={PenLine} index={0} label="Writer" title="Writer" />
          <TabsSubtleItem icon={BookOpen} index={1} label="Reading" title="Reading" />
        </TabsSubtle>
      )}
      {creationState === 'creating' && (
        <div className="markdown-status" role="status">
          Opening {name}
        </div>
      )}
      {creationState === 'failed' && (
        <div className="markdown-status flex-col gap-3" role="alert">
          <div>
            <p className="text-body font-medium">Could not open this Markdown document</p>
            <p className="mt-1 text-caption text-muted-foreground">
              The source is unchanged. Try opening the editor again.
            </p>
          </div>
          <Button
            leadingIcon={RefreshCw}
            onClick={() => setAttempt((current) => current + 1)}
            size="compact"
            variant="tertiary"
          >
            Try again
          </Button>
        </div>
      )}
      <div className={cn('markdown-crepe', readOnly && 'markdown-crepe-readonly')} ref={hostRef} />
    </div>
  );
}
