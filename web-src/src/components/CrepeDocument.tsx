import { useEffect, useRef } from 'react';
import { languages } from '@codemirror/language-data';
import { editorViewCtx } from '@milkdown/kit/core';
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
import { api, assetBaseUrl } from '../api';
import { resolveMilkdownLink } from '../milkdown/navigation';
import { useApp } from '../store/AppContext';
import { makeIframeFindController } from './findIframe';
import { applyChunkHighlight } from './previewChunkHighlight';
import { portableImageMarkdownPath, relativeAssetPath } from '../milkdown/paths';
import { splitLeadingYamlFrontmatter } from '../milkdown/frontmatter';
import { resolveLocalImageUrl } from '../milkdown/imageUrls';

/**
 * The single Markdown surface. CrepeBuilder provides Milkdown's maintained
 * authoring features, while StashBase keeps ownership of persistence, local
 * asset paths, navigation and the application-level find experience.
 */
export function CrepeDocument({ tabId, name, content, readOnly, active }: {
  tabId: string;
  name: string;
  content: string;
  readOnly: boolean;
  active: boolean;
}) {
  const { actions, activeTab } = useApp();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<CrepeBuilder | null>(null);
  const nameRef = useRef(name);
  const contentRef = useRef(content);
  const readOnlyRef = useRef(readOnly);
  const activeRef = useRef(active);
  const observedIncomingRef = useRef<string | null>(null);
  const suppressChangeRef = useRef(false);
  const frontmatterRef = useRef(splitLeadingYamlFrontmatter(content).source);
  nameRef.current = name;
  contentRef.current = content;
  readOnlyRef.current = readOnly;
  activeRef.current = active;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
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
        proxyDomURL: (source) => resolveLocalImageUrl(source, assetBaseUrl(nameRef.current), window.location.origin),
      })
      .addFeature(blockEdit)
      .addFeature(toolbar)
      .addFeature(table)
      .addFeature(codeMirror, { languages, copyText: 'Copy code' })
      .addFeature(latex);

    editor.setReadonly(readOnlyRef.current);
    editor.on((listener) => listener.markdownUpdated((_ctx, markdown, previous) => {
      if (!suppressChangeRef.current && markdown !== previous) actions.scheduleSave();
    }));
    editor.create().then(() => {
      if (disposed) return;
      editorRef.current = editor;
      refreshDocumentDom(host, nameRef.current);
      if (!readOnlyRef.current && activeRef.current) {
        actions.registerEditor({
          getValue: () => frontmatterRef.current + editor.getMarkdown(),
          focus: () => editor.editor.action((ctx) => ctx.get(editorViewCtx).focus()),
        });
      }
    }).catch((error: unknown) => {
      console.error('[markdown] failed to create Crepe editor:', error);
      actions.toast('Could not open the Markdown editor.', { level: 'error' });
    });

    return () => {
      disposed = true;
      if (editorRef.current === editor) editorRef.current = null;
      if (!readOnlyRef.current && activeRef.current) actions.registerEditor(null);
      void editor.destroy();
    };
    // The one document instance remains mounted across Writer Mode and Reading
    // View so its history and selection survive the interaction-boundary switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.setReadonly(readOnly);
    if (!readOnly && active) {
      actions.registerEditor({
        getValue: () => frontmatterRef.current + editor.getMarkdown(),
        focus: () => editor.editor.action((ctx) => ctx.get(editorViewCtx).focus()),
      });
    } else if (!readOnly) {
      actions.registerEditor(null);
    }
  }, [actions, active, readOnly]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const incoming = splitLeadingYamlFrontmatter(content);
    const current = editor.getMarkdown();
    const previousIncoming = observedIncomingRef.current;
    observedIncomingRef.current = content;
    frontmatterRef.current = incoming.source;
    if (previousIncoming === content || current === incoming.body) return;
    suppressChangeRef.current = true;
    editor.editor.action(replaceAll(incoming.body));
    queueMicrotask(() => { suppressChangeRef.current = false; });
  }, [content]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const frame = requestAnimationFrame(() => refreshDocumentDom(host, name));
    return () => cancelAnimationFrame(frame);
  }, [content, name, readOnly]);

  useEffect(() => {
    const controller = makeIframeFindController(
      () => hostRef.current?.ownerDocument ?? null,
      () => hostRef.current?.ownerDocument.defaultView ?? null,
      () => hostRef.current?.querySelector<HTMLElement>('.ProseMirror') ?? null,
      () => hostRef.current,
    );
    actions.registerFindController(controller);
    return () => actions.registerFindController(null);
  }, [actions, active]);

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
      const link = resolveMilkdownLink(anchor.getAttribute('href') ?? '', nameRef.current);
      if (link.kind === 'anchor') {
        host.querySelector<HTMLElement>(`#${CSS.escape(link.id)}`)?.scrollIntoView({ block: 'start' });
      } else if (link.kind === 'note') {
        void actions.navigateTo(link.path, link.anchor);
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
    if (!pendingAnchor || !hostRef.current) return;
    requestAnimationFrame(() => {
      hostRef.current?.querySelector<HTMLElement>(`#${CSS.escape(pendingAnchor)}`)?.scrollIntoView({ block: 'start' });
      actions.consumePendingScroll();
    });
  }, [actions, content, pendingAnchor]);

  const pendingHighlight = activeTab?.pendingHighlight ?? null;
  useEffect(() => {
    const host = hostRef.current;
    if (!pendingHighlight?.chunkText || !host?.ownerDocument) return;
    if (applyChunkHighlight(host.ownerDocument, pendingHighlight.chunkText, host)) actions.consumePendingHighlight();
  }, [actions, content, pendingHighlight]);

  return <div ref={hostRef} className={'crepe-shell' + (readOnly ? ' crepe-readonly' : '')} data-tab-id={tabId} hidden={!active} />;
}

async function uploadLocalImage(file: File, noteName: string): Promise<string> {
  const parts = noteName.split('/');
  parts.pop();
  const dir = parts.join('/');
  const result = await api.upload([{ file, relPath: file.name }], dir);
  const saved = result.files[0];
  if (!saved || saved.error) throw new Error(saved?.error ?? 'The image could not be saved.');
  const relative = relativeAssetPath(noteName, saved.file);
  return portableImageMarkdownPath(relative);
}

function refreshDocumentDom(host: HTMLElement, name: string): void {
  const base = new URL(assetBaseUrl(name), window.location.origin);
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
  const used = new Map<string, number>();
  for (const heading of host.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')) {
    const baseId = heading.textContent?.trim().toLowerCase().normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}_ -]/gu, '')
      .trim().replace(/\s+/g, '-') || 'section';
    const seen = used.get(baseId) ?? 0;
    used.set(baseId, seen + 1);
    heading.id = seen === 0 ? baseId : `${baseId}-${seen}`;
  }
}
