import { Paperclip } from 'lucide-react';
import {
  useId,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import { Button } from '@/components/ui/button';
import {
  InputMessage,
  type InputMessageEditorContext,
  type QueuedMessage,
} from '@/components/ui/input-message';
import type { AgentSessionRuntime } from '@/features/agent/application/session-runtime';
import {
  contextItemKey,
  rankMentionSuggestions,
  removeMentionText,
  segmentFileMentions,
  validateContext,
  type AgentContextItem,
  type AgentScopeEnvironment,
  type ContextStatus,
  type MentionQuery,
  type MentionSuggestion,
} from '@/features/agent/domain/context';
import type { SourceReference } from '@/shared/domain/source-reference';
import { dragCarriesSource, readSourceDrag } from '@/shared/utils/source-drag';

import { DraftSourceTiles, isVisualSource } from './context-tiles';
import { MentionEditor, type MentionEditorHandle, type MentionEditorProps } from './mention-editor';
import { MentionListbox, mentionOptionId } from './mention-listbox';

const ATTACH_ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf';

export interface AgentContextComposerProps {
  /** The runtime advertises that it can read transient uploads. */
  attachments: boolean;
  environment: AgentScopeEnvironment | null;
  leftSlot?: ReactNode;
  maxRows?: number;
  minRows?: number;
  onQueueChange: (queue: QueuedMessage[]) => void;
  onReprocess?: (source: SourceReference) => void;
  onStop: () => void;
  placeholder: string;
  queue: QueuedMessage[];
  rightSlot?: ReactNode;
  session: AgentSessionRuntime;
  status: 'idle' | 'streaming';
}

function acceptsUpload(file: File): boolean {
  return ATTACH_ACCEPT.split(',').includes(file.type);
}

function onDragOverCapture(event: DragEvent<HTMLDivElement>) {
  if (!dragCarriesSource(event.dataTransfer)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
}

/** The bottom-left slot: an attach control when the runtime can read
 *  uploads, then whatever the workspace places there. */
function attachSlot(attachments: boolean, leftSlot: ReactNode) {
  return ({ openFilePicker }: { openFilePicker: () => void }) => (
    <>
      {attachments && (
        <Button
          aria-label="Attach files"
          onClick={() => openFilePicker()}
          size="icon-compact"
          variant="ghost"
        >
          <Paperclip />
        </Button>
      )}
      {leftSlot}
    </>
  );
}

/** The editor slot: built outside render so the shared composer receives a
 *  stable render function rather than a component defined per render. */
function mentionEditorSlot(
  props: Omit<MentionEditorProps, 'ctx'> & { ref: Ref<MentionEditorHandle> },
) {
  return (ctx: InputMessageEditorContext) => <MentionEditor {...props} ctx={ctx} />;
}

/** The composer card: the mention editor in place of the textarea, the `@`
 *  listbox, source drops, transient uploads, and the preview row of tiles,
 *  all reading as one surface. A non-visual source lives inline as a chip
 *  where it was typed; a visual source and every upload sit in the row. */
export function AgentContextComposer({
  attachments,
  environment,
  leftSlot,
  maxRows = 6,
  minRows = 3,
  onQueueChange,
  onReprocess,
  onStop,
  placeholder,
  queue,
  rightSlot,
  session,
  status,
}: AgentContextComposerProps) {
  const { context, contextIssue, draft, queuedPrompts, scope } = useStore(
    session.store,
    useShallow((state) => ({
      context: state.context,
      contextIssue: state.contextIssue,
      draft: state.draft,
      queuedPrompts: state.queuedPrompts,
      scope: state.scope,
    })),
  );
  const editorRef = useRef<MentionEditorHandle>(null);
  const listboxId = useId();
  const [query, setQuery] = useState<MentionQuery | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scoped =
    environment && scope.kind === 'folder' && environment.folderPath === scope.path
      ? environment
      : null;
  const validations = useMemo(
    () =>
      validateContext(context, {
        listing: scoped?.listing ?? null,
        readiness: scoped?.readiness ?? {},
        scope,
      }),
    [context, scope, scoped],
  );
  const chipPaths = useMemo(
    () => context.flatMap((item) => (item.kind === 'source' ? [item.source.path] : [])),
    [context],
  );
  const statuses = useMemo(() => {
    const next: Record<string, ContextStatus> = {};
    for (const validation of validations) {
      if (validation.item.kind === 'source' && validation.status !== 'ready') {
        next[validation.item.source.path] = validation.status;
      }
    }
    return next;
  }, [validations]);
  // A visual source earns a tile only while the text does not mention it;
  // a non-visual source is always inline, so it never takes a tile.
  const mentioned = useMemo(
    () =>
      new Set(
        segmentFileMentions(draft).flatMap((segment) =>
          segment.kind === 'mention' ? [segment.path] : [],
        ),
      ),
    [draft],
  );
  const tileValidations = validations.filter(
    (validation) =>
      validation.item.kind === 'source' &&
      isVisualSource(validation.item) &&
      !mentioned.has(validation.item.source.path),
  );

  // Uploads render as the shared composer's own tiles, so the File behind
  // each bound upload is handed back to it.
  const uploads = useMemo(
    () =>
      context.flatMap((item) =>
        item.kind === 'transient' ? (session.fileForTransient(item.path) ?? []) : [],
      ),
    [context, session],
  );
  /** A File the composer hands back that this session already uploaded: a
   *  queued message being edited, or a tile re-added after removal. */
  const knownUpload = (file: File): AgentContextItem | undefined => {
    for (const item of [...context, ...queuedPrompts.flatMap((prompt) => prompt.context)]) {
      if (item.kind === 'transient' && session.fileForTransient(item.path) === file) return item;
    }
    return undefined;
  };
  const syncUploads = (next: File[]) => {
    for (const item of context) {
      if (item.kind !== 'transient') continue;
      const file = session.fileForTransient(item.path);
      if (file && !next.includes(file)) session.removeContext(contextItemKey(item));
    }
    const fresh: File[] = [];
    for (const file of next) {
      if (uploads.includes(file)) continue;
      const known = knownUpload(file);
      if (known) session.addContext(known);
      else fresh.push(file);
    }
    if (fresh.length > 0) void session.attachFiles(fresh);
  };

  const suggestions = useMemo(
    () => (query && scoped ? rankMentionSuggestions(scoped.listing, query.query) : []),
    [query, scoped],
  );
  const open = query !== null && suggestions.length > 0;
  const activeRow = Math.min(activeIndex, Math.max(0, suggestions.length - 1));

  const bindSource = (source: SourceReference) => {
    const listed = scoped?.listing.files.find((file) => file.path === source.path);
    session.addContext({
      boundVersion: scoped?.versions[source.path] ?? null,
      format: listed?.format ?? 'generic',
      kind: 'source',
      source,
    });
  };

  /** A chip entered the text: bind the listed file behind it. A folder
   *  mention stays text. */
  const onMentionAdded = (path: string) => {
    if (scope.kind !== 'folder') return;
    if (!scoped?.listing.files.some((file) => file.path === path)) return;
    bindSource({ folderPath: scope.path, path });
  };
  const onMentionRemoved = (path: string) => {
    if (scope.kind !== 'folder') return;
    session.removeContext(`source:${scope.path}/${path}`);
  };

  const pick = (suggestion: MentionSuggestion): boolean => {
    if (!query) return false;
    editorRef.current?.insertMention(suggestion.path);
    setActiveIndex(0);
    return true;
  };

  const removeTile = (item: AgentContextItem) => {
    session.removeContext(contextItemKey(item));
    if (item.kind === 'source') session.setDraft(removeMentionText(draft, item.source.path));
  };

  const onDropCapture = (event: DragEvent<HTMLDivElement>) => {
    if (!dragCarriesSource(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    const source = readSourceDrag(event.dataTransfer);
    if (!source) return;
    const listed = scoped?.listing.files.find((file) => file.path === source.path);
    const visual =
      listed !== undefined &&
      isVisualSource({ boundVersion: null, format: listed.format, kind: 'source', source });
    if (visual) {
      bindSource(source);
      return;
    }
    // A non-visual source lives inline; the chip binds it on insertion, and
    // a source outside the listing is still bound explicitly.
    editorRef.current?.insertMention(source.path);
    bindSource(source);
  };

  const onPasteCapture = (event: ClipboardEvent<HTMLDivElement>) => {
    if (!attachments) return;
    const files = Array.from(event.clipboardData?.files ?? []).filter(acceptsUpload);
    if (files.length === 0) return;
    event.preventDefault();
    void session.attachFiles(files);
  };

  const listbox = {
    activeOptionId: open ? mentionOptionId(listboxId, activeRow) : undefined,
    controls: open ? listboxId : undefined,
    onAccept: () => {
      const suggestion = suggestions[activeRow];
      return suggestion ? pick(suggestion) : false;
    },
    onDismiss: () => setActiveIndex(0),
    onNavigate: (direction: 1 | -1) =>
      setActiveIndex((activeRow + direction + suggestions.length) % suggestions.length),
    open,
  };

  return (
    <div
      className="relative flex flex-col rounded-2xl bg-surface-3 shadow-surface-3 transition-[box-shadow] duration-80 focus-within:ring-1 focus-within:ring-foreground/20"
      onDragOverCapture={onDragOverCapture}
      onDropCapture={onDropCapture}
      onPasteCapture={onPasteCapture}
    >
      {open && (
        <MentionListbox
          activeIndex={activeRow}
          id={listboxId}
          onHover={setActiveIndex}
          onPick={pick}
          suggestions={suggestions}
        />
      )}
      {contextIssue && (
        <p className="m-0 px-3 pt-2 text-caption text-destructive" role="alert">
          {contextIssue}
        </p>
      )}
      <InputMessage
        accept={ATTACH_ACCEPT}
        // The card above carries the surface and the focus ring; the inner
        // component must not draw its own edge, including its inline one.
        className="bg-transparent shadow-none!"
        {...(attachments ? { files: uploads, onFilesChange: syncUploads } : {})}
        editor={mentionEditorSlot({
          chipPaths,
          listbox,
          onMentionAdded,
          onMentionRemoved,
          onQueryChange: (next) => {
            setQuery(next);
            if (next === null) setActiveIndex(0);
          },
          ref: editorRef,
          statuses,
        })}
        leftSlot={attachSlot(attachments, leftSlot)}
        maxRows={maxRows}
        minRows={minRows}
        onQueueChange={onQueueChange}
        onSend={(text, _files, meta) =>
          void session.sendPrompt(text, meta?.queuedId ? { queuedId: meta.queuedId } : undefined)
        }
        onStop={onStop}
        onValueChange={session.setDraft}
        placeholder={placeholder}
        previewSlot={
          tileValidations.length > 0 ? (
            <div aria-label="Attached context" className="contents" role="list">
              <DraftSourceTiles
                onRemove={removeTile}
                onReprocess={onReprocess}
                size={80}
                validations={tileValidations}
              />
            </div>
          ) : undefined
        }
        queue={queue}
        rightSlot={rightSlot}
        status={status}
        value={draft}
      />
    </div>
  );
}
