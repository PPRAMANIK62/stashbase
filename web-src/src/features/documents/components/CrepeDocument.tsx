import { useEffect, useRef, useState } from 'react';
import '@/features/documents/documents.css';
import { languages } from '@codemirror/language-data';
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { clearTextInCurrentBlockCommand } from '@milkdown/kit/preset/commonmark';
import { replaceAll } from '@milkdown/kit/utils';
import { CrepeBuilder } from '@milkdown/crepe/builder';
import { blockEdit } from '@milkdown/crepe/feature/block-edit';
import { codeMirror } from '@milkdown/crepe/feature/code-mirror';
import { cursor } from '@milkdown/crepe/feature/cursor';
import { imageBlock } from '@milkdown/crepe/feature/image-block';
import { latex } from '@milkdown/crepe/feature/latex';
import { linkTooltip } from '@milkdown/crepe/feature/link-tooltip';
import { listItem } from '@milkdown/crepe/feature/list-item';
import { placeholder } from '@milkdown/crepe/feature/placeholder';
import { table } from '@milkdown/crepe/feature/table';
import { toolbar } from '@milkdown/crepe/feature/toolbar';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import { assetBaseUrl } from '@/common/api/api';
import { resolveMilkdownLink } from '@/features/documents/milkdown/navigation';
import { useAppActions, useWorkspace } from '@/store/contexts/AppContext';
import { makeIframeFindController } from '@/features/documents/lib/findIframe';
import { applyChunkHighlight } from '@/features/documents/lib/previewChunkHighlight';
import { uploadLocalImage } from '@/features/documents/milkdown/imageUpload';
import { insertLinkText } from '@/features/documents/milkdown/linkInsertion';
import { linkFileInsertionText } from '@/features/documents/milkdown/linkFileInsertion';
import { openLinkFilePicker } from '@/features/documents/milkdown/linkFilePickerTrigger';
import { imagePreviewFeature } from '@/features/documents/milkdown/imagePreview';
import { splitLeadingYamlFrontmatter } from '@/features/documents/milkdown/frontmatter';
import { planIncomingMarkdownSync, startCrepeCreation } from '@/features/documents/milkdown/crepeLifecycle';
import { resolveLocalImageUrl } from '@/features/documents/milkdown/imageUrls';
import { activeHeadingId, extractDocumentHeadings, headingSlug, type ProseMirrorDocument } from '@/features/documents/milkdown/headings';
import type { DocumentHeading } from '@/common/lib/documentOutline';
import { documentScroller, headingElementAtPosition, scrollOutlineToHeading, type HeadingNodeView } from '@/features/documents/milkdown/outlineNavigation';
import { useDocumentOutline } from '@/common/components/DocumentOutlineContext';
import { Button } from '@/common/components/ui/button';
import { StatusMessage } from '@/common/components/ui/status';
import { cn } from '@/common/lib/utils';

/** Chain-link glyph for the "Link to file…" slash-menu item, matching the
 *  bare-svg-string shape Crepe's own built-in item icons use. */
const LINK_TO_FILE_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
  </svg>
`;

type CreationState = 'creating' | 'ready' | 'failed';
type RegistrationKind = 'editor' | 'find' | 'outline';

const registrationOwners: Record<RegistrationKind, symbol | null> = {
  editor: null,
  find: null,
  outline: null,
};

function claimRegistration(
  kind: RegistrationKind,
  owner: symbol,
  register: () => void,
  clear: () => void,
): () => void {
  registrationOwners[kind] = owner;
  register();
  return () => {
    if (registrationOwners[kind] !== owner) return;
    registrationOwners[kind] = null;
    clear();
  };
}
import { basename } from '@/common/lib/paths';

/**
 * A retained Markdown surface for one tab. CrepeBuilder provides Milkdown's
 * maintained authoring features, while StashBase keeps ownership of
 * persistence, local asset paths, navigation and the application-level find
 * experience.
 */
export function CrepeDocument({ tabId, name, content, readOnly, active, dirty, folder }: {
  tabId: string;
  name: string;
  content: string;
  readOnly: boolean;
  active: boolean;
  dirty: boolean;
  /** Absolute member folder for an out-of-folder tab — image/link
   *  resolution carries it so relative refs stay in the file's folder. */
  folder?: string;
}) {
  const { activeTab } = useWorkspace();
  const { actions } = useAppActions();
  const registerEditor = actions.registerEditor;
  const registerFindController = actions.registerFindController;
  const scheduleSave = actions.scheduleSave;
  const toast = actions.toast;
  const { publishOutline, clearOutline } = useDocumentOutline();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<CrepeBuilder | null>(null);
  const registrationOwnerRef = useRef(Symbol(tabId));
  const nameRef = useRef(name);
  const folderRef = useRef(folder);
  const contentRef = useRef(content);
  const readOnlyRef = useRef(readOnly);
  const activeRef = useRef(active);
  const dirtyRef = useRef(dirty);
  // The builder already consumes the initial prop as `defaultValue`. Mark it
  // observed up front so the post-create content effect cannot mistake that
  // same initial source for an external refresh and erase typing that began
  // as soon as the editor became visible.
  const observedIncomingRef = useRef(content);
  const suppressChangeRef = useRef(false);
  const refreshHeadingsRef = useRef<() => void>(() => {});
  const frontmatterRef = useRef(splitLeadingYamlFrontmatter(content).source);
  const headingSnapshotRef = useRef<HeadingSnapshot | null>(null);
  const [creationState, setCreationState] = useState<CreationState>('creating');
  const [creationAttempt, setCreationAttempt] = useState(0);
  const [headings, setHeadings] = useState<DocumentHeading[]>([]);
  const [activeHeading, setActiveHeading] = useState<string | null>(null);
  nameRef.current = name;
  folderRef.current = folder;
  contentRef.current = content;
  readOnlyRef.current = readOnly;
  activeRef.current = active;
  dirtyRef.current = dirty;

  const syncIncomingMarkdown = (editor: CrepeBuilder, source: string, sourceDirty: boolean) => {
    const incoming = splitLeadingYamlFrontmatter(source);
    const plan = planIncomingMarkdownSync({
      currentBody: editor.getMarkdown(),
      dirty: sourceDirty,
      incomingBody: incoming.body,
      incomingFrontmatter: incoming.source,
      incomingSource: source,
      observedSource: observedIncomingRef.current,
    });
    if (!plan) return;
    observedIncomingRef.current = plan.observedSource;
    frontmatterRef.current = plan.frontmatter;
    if (plan.replacementBody === null) return;
    suppressChangeRef.current = true;
    editor.editor.action(replaceAll(plan.replacementBody));
    queueMicrotask(() => {
      suppressChangeRef.current = false;
      // Read the new ProseMirror state after the replacement transaction;
      // DOM decoration stays in its own render/effect pass.
      refreshHeadingsRef.current();
    });
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren();
    setCreationState('creating');
    headingSnapshotRef.current = null;
    let cancelReadyDecoration = () => {};
    const editor = new CrepeBuilder({ root: host, defaultValue: splitLeadingYamlFrontmatter(contentRef.current).body })
      .addFeature(placeholder, { text: 'Start writing… or type /', mode: 'block' })
      .addFeature(cursor)
      .addFeature(listItem)
      .addFeature(linkTooltip, {
        inputPlaceholder: 'Paste a URL or note path…',
        onCopyLink: (href) => { void navigator.clipboard?.writeText(href); },
      })
      .addFeature(imageBlock, {
        onUpload: (file) => uploadLocalImage(file, nameRef.current),
        inlineOnUpload: (file) => uploadLocalImage(file, nameRef.current),
        blockOnUpload: (file) => uploadLocalImage(file, nameRef.current),
        inlineUploadPlaceholderText: 'Upload image',
        blockUploadPlaceholderText: 'Upload image',
        blockCaptionPlaceholderText: 'Describe this image…',
        proxyDomURL: (source) => resolveLocalImageUrl(source, assetBaseUrl(nameRef.current, folderRef.current), window.location.origin),
      })
      .addFeature(blockEdit, {
        buildMenu: (builder) => {
          // Out-of-folder tabs have no per-folder file listing to pick
          // from — `state.files` is only ever the active folder's files —
          // so the item is omitted outright rather than opening a picker
          // with the wrong or an empty result set. Known, accepted V1 gap.
          if (folderRef.current) return;
          builder.addGroup('stashbase-link', 'Link').addItem('link-to-file', {
            label: 'Link to file…',
            icon: LINK_TO_FILE_ICON,
            onRun: (ctx) => {
              // Same cleanup Crepe's own built-in items perform before
              // acting: clear the typed `/query` text first.
              ctx.get(commandsCtx).call(clearTextInCurrentBlockCommand.key);
              const view = ctx.get(editorViewCtx);
              const insertPos = view.state.selection.from;
              openLinkFilePicker({
                onSelect: (targetPath) => {
                  const { displayName, href } = linkFileInsertionText(nameRef.current, targetPath);
                  insertLinkText(ctx, insertPos, displayName, href);
                },
                onCancel: () => { view.focus(); },
              });
            },
          });
        },
      })
      .addFeature(toolbar)
      .addFeature(table)
      .addFeature(codeMirror, { languages, copyText: 'Copy code' })
      .addFeature(latex)
      // Keyboard twin of the host click listener below: Enter on a selected
      // image node posts the same preview message the click path posts.
      .addFeature(imagePreviewFeature);

    const updateHeadings = () => {
      const view = currentEditorView(editor);
      setHeadings(headingsForView(view, headingSnapshotRef));
    };
    refreshHeadingsRef.current = updateHeadings;
    editor.setReadonly(readOnlyRef.current);
    editor.on((listener) => listener.markdownUpdated((_ctx, markdown, previous) => {
      if (
        activeRef.current
        && !readOnlyRef.current
        && !suppressChangeRef.current
        && markdown !== previous
      ) scheduleSave();
      updateHeadings();
    }));
    const stopCreation = startCrepeCreation(editor, {
      ready: () => {
        editorRef.current = editor;
        editor.setReadonly(readOnlyRef.current);
        // Reconcile props again after async creation. Activation revalidation
        // may have delivered newer disk source while no editorRef existed.
        syncIncomingMarkdown(editor, contentRef.current, dirtyRef.current);
        cancelReadyDecoration = scheduleDocumentDomRefresh(host, nameRef.current, folderRef.current);
        updateHeadings();
        setCreationState('ready');
      },
      failed: (error) => {
        console.error('[markdown] failed to create Crepe editor:', error);
        toast('Could not open the Markdown editor.', { level: 'error' });
        setCreationState('failed');
      },
    });

    return () => {
      if (editorRef.current === editor) editorRef.current = null;
      if (refreshHeadingsRef.current === updateHeadings) refreshHeadingsRef.current = () => {};
      cancelReadyDecoration();
      stopCreation();
    };
    // The one document instance remains mounted across Writer Mode and Reading
    // View so its history and selection survive the interaction-boundary switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creationAttempt, tabId]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.setReadonly(readOnly);
  }, [readOnly]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || creationState !== 'ready' || !active || readOnly) return;
    const owner = registrationOwnerRef.current;
    return claimRegistration(
      'editor',
      owner,
      () => registerEditor({
        getValue: () => frontmatterRef.current + editor.getMarkdown(),
        focus: () => editor.editor.action((ctx) => ctx.get(editorViewCtx).focus()),
      }),
      () => registerEditor(null),
    );
  }, [active, creationState, readOnly, registerEditor]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    syncIncomingMarkdown(editor, content, dirty);
  }, [content, dirty]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    return scheduleDocumentDomRefresh(host, name, folder);
  }, [content, folder, name, readOnly]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const frame = requestAnimationFrame(() => applyHeadingIds(host, headings));
    return () => cancelAnimationFrame(frame);
  }, [headings]);

  useEffect(() => {
    if (!active || creationState !== 'ready') return;
    const host = hostRef.current;
    if (!host) return;
    const scroller = documentScroller(host);
    const updateActive = () => {
      const threshold = scroller.getBoundingClientRect().top + 16;
      const view = currentEditorView(editorRef.current);
      const currentHeadings = headingsForView(view, headingSnapshotRef);
      const positions = currentHeadings.flatMap((heading) => {
        const element = headingElementAtPosition(view, heading.position);
        return element ? [{ id: heading.id, top: element.getBoundingClientRect().top }] : [];
      });
      setActiveHeading(activeHeadingId(currentHeadings, positions, threshold));
    };
    scroller.addEventListener('scroll', updateActive, { passive: true });
    updateActive();
    return () => scroller.removeEventListener('scroll', updateActive);
  }, [active, creationState, headings]);

  useEffect(() => {
    if (!active || creationState !== 'ready') return;
    const owner = registrationOwnerRef.current;
    return claimRegistration('outline', owner, () => undefined, clearOutline);
  }, [active, clearOutline, creationState]);

  useEffect(() => {
    if (
      !active
      || creationState !== 'ready'
      || registrationOwners.outline !== registrationOwnerRef.current
    ) return;
    publishOutline({
      headings,
      activeId: activeHeading,
      onSelect: (heading) => scrollOutlineToHeading(
        hostRef.current,
        heading,
        currentEditorView(editorRef.current),
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      ),
    });
  }, [active, activeHeading, creationState, headings, publishOutline]);

  useEffect(() => {
    if (!active || creationState !== 'ready') return;
    const owner = registrationOwnerRef.current;
    const controller = makeIframeFindController(
      () => hostRef.current?.ownerDocument ?? null,
      () => hostRef.current?.ownerDocument.defaultView ?? null,
      () => hostRef.current?.querySelector<HTMLElement>('.ProseMirror') ?? null,
      // Milkdown owns the document's scrollport. The surrounding shell fills
      // the pane but does not scroll, so Find must target `.milkdown` to bring
      // an off-screen current match into view.
      () => hostRef.current?.querySelector<HTMLElement>('.milkdown') ?? null,
    );
    return claimRegistration(
      'find',
      owner,
      () => registerFindController(controller),
      () => registerFindController(null),
    );
  }, [active, creationState, registerFindController]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const blockRemoteImageUrl = (event: Event) => {
      const input = event.target as HTMLInputElement | null;
      if (!input?.matches('.image-edit .link-input-area')) return;
      input.value = '';
      event.stopPropagation();
    };
    host.addEventListener('input', blockRemoteImageUrl, true);
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest) return;
      const image = target.closest('img') as HTMLImageElement | null;
      if (image) {
        event.preventDefault();
        window.postMessage({ type: 'stashbase-preview-image', src: image.currentSrc || image.src, alt: image.alt || '' }, window.location.origin);
        return;
      }
      const anchor = target.closest('a') as HTMLAnchorElement | null;
      if (!anchor) return;
      // Markdown links are untrusted input. Take ownership before routing the
      // explicitly allowed targets so ignored schemes never reach the browser.
      event.preventDefault();
      const link = resolveMilkdownLink(anchor.getAttribute('href') ?? '', nameRef.current, folderRef.current);
      if (link.kind === 'anchor') {
        host.querySelector<HTMLElement>(`#${CSS.escape(link.id)}`)?.scrollIntoView({ block: 'start' });
      } else if (link.kind === 'library-file') {
        // A link inside an out-of-folder document resolves within that same
        // member folder — never against the window's active folder.
        if (link.folder) void actions.openLibraryFile(link.folder, link.path, { anchor: link.anchor });
        else void actions.navigateTo(link.path, link.anchor);
      } else if (link.kind === 'external') {
        window.postMessage({ type: 'stashbase-open-external', href: link.href }, window.location.origin);
      }
    };
    host.addEventListener('click', onClick);
    return () => {
      host.removeEventListener('input', blockRemoteImageUrl, true);
      host.removeEventListener('click', onClick);
    };
  }, []);

  const pendingAnchor = activeTab?.pendingAnchor ?? null;
  useEffect(() => {
    if (!active || creationState !== 'ready' || !pendingAnchor || !hostRef.current) return;
    const frame = requestAnimationFrame(() => {
      if (!activeRef.current) return;
      hostRef.current?.querySelector<HTMLElement>(`#${CSS.escape(pendingAnchor)}`)?.scrollIntoView({ block: 'start' });
      actions.consumePendingScroll();
    });
    return () => cancelAnimationFrame(frame);
  }, [actions, active, content, creationState, pendingAnchor]);

  const pendingHighlight = activeTab?.pendingHighlight ?? null;
  useEffect(() => {
    if (!active || creationState !== 'ready') return;
    const host = hostRef.current;
    if (!pendingHighlight?.chunkText || !host?.ownerDocument) return;
    if (applyChunkHighlight(host.ownerDocument, pendingHighlight.chunkText, host)) actions.consumePendingHighlight();
  }, [actions, active, content, creationState, pendingHighlight]);

  return (
    <div
      className="crepe-surface"
      data-document-name={name}
      data-state={creationState}
      data-tab-id={tabId}
      role="region"
      aria-label={`${basename(name)} Markdown document`}
      hidden={!active}
    >
      {creationState === 'creating' && (
        <StatusMessage className="crepe-status">Opening document…</StatusMessage>
      )}
      {creationState === 'failed' && (
        <StatusMessage className="crepe-status crepe-error" tone="error">
          <span>Could not open this Markdown document.</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setCreationState('creating');
              setCreationAttempt((attempt) => attempt + 1);
            }}
          >
            Try again
          </Button>
        </StatusMessage>
      )}
      <div ref={hostRef} className={cn('crepe-shell', readOnly && 'crepe-readonly')} />
    </div>
  );
}


/** Milkdown may finish replacing read-only node views one frame after React's
 * effects. Decorate on the following frame so alerts and local assets attach
 * to the settled DOM without running from a transaction listener. */
function scheduleDocumentDomRefresh(host: HTMLElement, name: string, folder?: string): () => void {
  let secondFrame: number | null = null;
  const firstFrame = requestAnimationFrame(() => {
    secondFrame = requestAnimationFrame(() => refreshDocumentDom(host, name, folder));
  });
  return () => {
    cancelAnimationFrame(firstFrame);
    if (secondFrame !== null) cancelAnimationFrame(secondFrame);
  };
}

function refreshDocumentDom(host: HTMLElement, name: string, folder?: string): void {
  const base = new URL(assetBaseUrl(name, folder), window.location.origin);
  for (const element of host.querySelectorAll<HTMLImageElement>('img[src]')) {
    const raw = element.dataset.stashbaseSource ?? element.getAttribute('src');
    if (!raw || raw.startsWith('#')) continue;
    if (/^[a-z][a-z\d+.-]*:/i.test(raw)) {
      try {
        const url = new URL(raw);
        if (url.origin === window.location.origin && url.pathname.startsWith('/asset/')) continue;
      } catch { /* fall through and keep malformed schemes inert */ }
      // StashBase never turns a document image into an unmediated remote
      // request. Workspace-owned relative sources are resolved below.
      element.removeAttribute('src');
      continue;
    }
    try {
      element.dataset.stashbaseSource = raw;
      element.src = new URL(raw, base).href;
    } catch { /* keep malformed values inert */ }
  }
  for (const quote of host.querySelectorAll<HTMLElement>('blockquote')) {
    quote.classList.remove(
      'stashbase-alert',
      'stashbase-alert-note',
      'stashbase-alert-tip',
      'stashbase-alert-important',
      'stashbase-alert-warning',
      'stashbase-alert-caution',
    );
    quote.removeAttribute('role');
    quote.removeAttribute('aria-label');
    const firstParagraph = quote.querySelector<HTMLElement>('p');
    const firstText = firstParagraph?.firstChild;
    if (!firstText || firstText.nodeType !== Node.TEXT_NODE) continue;
    const match = firstText.textContent?.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i);
    if (!match) continue;
    const variant = match[1].toLowerCase();
    quote.classList.add('stashbase-alert', `stashbase-alert-${variant}`);
    quote.setAttribute('role', 'note');
    quote.setAttribute('aria-label', match[1][0] + match[1].slice(1).toLowerCase());
  }
  applyHeadingIds(host);
}

function applyHeadingIds(host: HTMLElement, entries?: DocumentHeading[]) {
  const used = new Map<string, number>();
  Array.from(host.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')).forEach((heading, index) => {
    if (entries?.[index]) { heading.id = entries[index].id; return; }
    const base = headingSlug(heading.textContent ?? '');
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    heading.id = seen === 0 ? base : `${base}-${seen}`;
  });
}

function currentEditorView(editor: CrepeBuilder | null): HeadingNodeView | null {
  return editor?.editor.action((ctx) => ctx.get(editorViewCtx)) ?? null;
}

type HeadingSnapshot = { doc: ProseMirrorDocument; headings: DocumentHeading[] };

function headingsForView(view: HeadingNodeView | null, cache: { current: HeadingSnapshot | null }): DocumentHeading[] {
  if (!view) return [];
  const current = cache.current;
  if (current?.doc === view.state.doc) return current.headings;
  const headings = extractDocumentHeadings(view.state.doc);
  cache.current = { doc: view.state.doc, headings };
  return headings;
}
