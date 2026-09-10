# Document Viewers

> Review contract for the viewer registry, non-Markdown source viewers, preview
> freshness, failure states, navigation, and document-content trust boundaries.

## Viewer Contract

- `renderer/src/features/documents/ui/source/registry.tsx` is the one
  `documentViewers` table, keyed by `DocumentViewerFormat`. Each entry declares
  its lazy component, whether the viewer claims Find, whether it publishes an
  outline, its tab icon, the services it takes, and its status renderer. Adding
  a format is one entry plus one module under
  `renderer/src/features/documents/ui/source/viewers/markdown.tsx` and its
  siblings. `renderer/src/features/documents/ui/source/document.tsx` is the
  only dispatcher, and it reads the entry rather than testing the format.
- The service list narrows the viewer's props. A viewer's props are the shared
  viewer context intersected with exactly the services its entry names, so a
  viewer that reaches for a service its entry left out fails to compile at the
  entry. Ports stay injected, so no viewer selects its own adapter and no viewer
  owns a navigation callback. The contract is
  `renderer/src/features/documents/ui/source/viewer.ts`.
- The registry is a parameter, not a global. Both the dispatcher and
  `renderer/src/features/documents/ui/workspace/workspace.tsx` accept an
  override, which is how a test registers a viewer of its own without editing
  the shipping table.
- The [Documents format capability matrix](../design-docs/design/documents.md#format-capability-matrix)
  owns the user-visible distinction among preview, authoring, retrieval text,
  and Agent/MCP access. Viewer dispatch and affordances must match it.
  Previewability never implies content editing or text-readable MCP access.
- Format classification is one function over the shared vocabulary.
  `renderer/src/features/documents/domain/document-format.ts` derives both the
  editable-text format and the viewer format from the extension sets in
  `shared/file-formats.ts`, so the renderer and the server file listing cannot
  disagree about what a name is. A name nothing claims classifies as `generic`.
- Two shared surfaces carry every viewer.
  `renderer/src/features/documents/ui/source/asset.tsx` resolves the versioned
  asset URL, promotes preparation once per open, and composes the preparation
  status row for the formats that declare a slot.
  `renderer/src/features/documents/ui/source/text.tsx` loads the versioned
  source, reports the save outcome, and hands a refused save to the comparison
  view. A viewer contributes only what it renders inside.
- A viewer is selected from the visible source format and retains that source
  as tab identity. Prepared text is evidence and fallback, never a replacement
  tab.
- Byte-backed viewers remount on the source version, so a changed source cannot
  leave older bytes on screen. Late work is refused by the scope guard in
  `renderer/src/features/documents/application/document-runtime.ts`, which
  compares the document scope and the operation generation an operation was
  captured under before any completion applies.
- Parse, decode, worker, or preparation failure leaves the source tab visible
  with an explicit, format-appropriate recovery state. A failure that came off a
  port takes its sentence from that capability's failure family in
  `renderer/src/features/documents/application/failure-messages.ts`, selected by
  `kind` and rendered by the entry's own status renderer, so no adapter and no
  transport wording reaches a reader. A viewer authors a sentence only for a
  condition no port can report, which is a resource that loaded but is not the
  shape it can render. A developer-facing diagnostic travels as an error cause
  and is never shown. Each family's map is typed over its whole failure ladder,
  so adding a kind fails the build there rather than silently showing the wrong
  recovery, and an unrecognized rejection falls through to that family's
  `unavailable` sentence.
- Find and outline have exactly one owner at a time.
  `renderer/src/features/documents/application/navigation-runtime.ts` hands the
  claim to the active tab's viewer against an owner symbol and releases it on
  unmount, so a hidden tab's controller cannot answer a query. Registration
  cleanup is ownership-aware, so a departing viewer cannot clear a newer
  claim. A format whose entry declares no Find shows no find bar at all.
- Find, anchors, search targets, links, image activation, and keyboard commands
  route through the application runtimes. Viewer DOM cannot become a second
  navigation or file-mutation owner. Every untrusted href resolves through the
  single resolver
  `renderer/src/features/documents/domain/link-target.ts`, shared by the
  Markdown, DOCX, and HTML paths.
- Direct preview and durable preparation are independent. A direct DOCX view may
  succeed while searchable extraction is pending or failed, and neither state
  may falsely complete the other. Preparation status and its commands are
  composed above the viewer by the folder shell, so no viewer holds preparation
  state or performs file mutation.
- A generic workspace entry is not admitted to a normal document-read path.
  Selection invokes the separate bounded preview Interface in
  `server/generic-file-preview.ts`. A name that classifies as a known viewer
  format is refused there outright, known binary extensions fail fast, and other
  regular files are admitted only by strict UTF-8 decoding with no NUL and no
  meaningful non-whitespace C0 density. Sources above `8 MiB` remain unloaded.
  Text is always read-only. Binary, invalid encoding, oversized, unreadable,
  cloud-placeholder, symlink, and special-entry results retain the source name,
  size when available, and a reveal action.

## Trust Boundary

Markdown renders structured node trees and never injects a raw HTML string.
DOCX-derived HTML is sanitized inside the converting Worker by
`shared/html-sanitization.ts`, so the string that crosses back to the renderer
is already policy-clean and the renderer holds no unsanitized document HTML.
One allow-list serves both the renderer Worker and the server's durable
preparation worker, which receives the serializable half of the same policy.
Protocol-relative references are disallowed, link schemes are limited to HTTP,
HTTPS, and mailto, and a DOCX embedded image is admitted only as an HTTP,
HTTPS, or strictly typed base64 image data URL.

Local HTML renders in an iframe with `sandbox="allow-scripts"` and no
`allow-same-origin`, and with `referrerPolicy="no-referrer"`. The document runs
at an opaque origin, so its scripts can paint the page but receive no
same-origin access, no preload bridge, and no navigation, popup, form,
download, or permission capability. Do not add `allow-same-origin` to this
frame. Doing so would return document code to the application's loopback
origin.

Frame messages are authorized before they are applied. The receiver checks that
the event source is this frame's own content window, validates the message
shape and an `8,192` character href ceiling, and requires a live user
activation before opening an external link, except for the derived DOCX preview
the server itself produced. Same-origin and non-HTTP(S) targets are dropped. HTTP(S) navigation
goes through the system browser, and a host that refuses to open a link says so
rather than leaving the click looking successful. Relative source links resolve
only to segments inside the owning folder, and the resolver rejects an absolute
path, a network path, an empty, dot, parent, or separator-bearing segment, a
control character, and credentials in a URL. Code blocks never execute
regardless of language label.

## Resource Discipline

Heavy renderer resources use bounded, version-keyed caches with explicit
disposal, and only measured or unbounded collections are virtualized. Suspense
is reserved for lazy code. An ordinary data refresh preserves safe content
rather than blanking the view.

- Every document query key carries folder, path, tab, and runtime generation,
  and the preview keys carry the source version as well, so no cached preview
  can outlive the bytes it was made from. The keys are
  `renderer/src/features/documents/application/queries.ts`. Disposing a document
  cancels and removes its whole key scope.
- Disposal is explicit at every heavy seam. A PDF load owns its own worker port
  and destroys the task, the worker, and the port together
  (`renderer/src/features/documents/ui/pdf/loader.ts`); a document that resolves
  after its effect was cancelled is destroyed rather than retained
  (`renderer/src/features/documents/ui/pdf/use-pdf-document.ts`); a page cancels
  its render task and text layer and calls `cleanup` on teardown
  (`renderer/src/features/documents/ui/pdf/page.tsx`); the DOCX Worker is
  terminated on success, failure, abort, and timeout alike
  (`renderer/src/features/documents/infrastructure/docx-preview-api.ts`); the
  captions object URL is revoked when its transcript changes
  (`renderer/src/features/documents/ui/media/document.tsx`); a Find controller
  disconnects its observer and clears its highlight registry entries; and one
  CodeMirror session lives exactly as long as its tab
  (`renderer/src/features/documents/ui/code-editor/use-editor-session.ts`).
- Retention of mounted editors is bounded, not incidental. Markdown keeps a
  bounded MRU of mounted surfaces, owned by
  [Markdown Rendering](markdown-rendering.md). Every other format mounts only
  while it is the active tab. The open-tab set itself is bounded by the reader,
  and each tab's runtime retains its own source text for reactivation.
- PDF page rendering is the renderer's one windowed collection, and
  `renderer/src/features/documents/ui/pdf/page.tsx` is the only module in
  `renderer/src` that windows anything. Page count is unbounded, the placeholder
  box comes from the measured first-page viewport, and a page that leaves the
  observed margin clears its canvas and empties its text layer, so the
  expensive part of a long PDF is bounded by the viewport rather than by the
  document.
- Suspense wraps only lazily imported components, which is every viewer chunk,
  the conflict comparison, and the editor surfaces. Data arrives through queries
  whose pending, fetching, and error states the surfaces read directly, so no
  Suspense boundary suspends on a data read.
- A text refresh preserves what is on screen. The text surface shows the status
  panel only on the first load, announces a background refresh to assistive
  technology without replacing content, and on a failed refresh keeps the last
  loaded source under an explicit retry banner. A CodeMirror surface takes new
  content as a minimal diff rather than a rebuild, so selection and undo history
  survive. When something else writes a source, `refreshDocumentSources` lets a
  clean editor take the newer disk text and leaves a dirty editor its draft to
  meet the versioned conflict path on its next save.

**Known gap, a failed asset refresh blanks a working preview.** The asset
surface replaces the viewer with its failure panel whenever the query reports an
error, including a background refetch that failed while a usable asset was
already resolved. The text surface preserves content in the same situation. The
Required behavior above is the text surface's. A fix belongs in
`renderer/src/features/documents/ui/source/asset.tsx` and should distinguish a
first load from a refresh, with coverage for a retained preview surviving one
failed refetch.

**Known gap, the active-line paint is not scoped to focus.** The shared code
surface installs `highlightActiveLine` unconditionally and paints
`.cm-activeLine` in `renderer/src/features/documents/ui/code-editor/surface.ts`,
and the Markdown code block repeats the paint in
`renderer/src/features/documents/ui/markdown/document.css`. Every unfocused
CodeMirror keeps a cursor parked on line 1, so a JSON source pane, a TXT
editor, a generic viewer, and every code block in a document at rest all show a
band across their first line. Scoping both paints to a focused editor is the
fix.

**Known gap, two unbounded row lists have no page size.** The PDF page list
mounts one placeholder element and one intersection observer per page even
though only the near-viewport pages render, so element and observer count still
scale with the document. Media transcript segments render eagerly with no cap
and no windowing, so a long recording mounts one row per segment. This is drift
from an established in-repo pattern rather than a missing virtualization layer.
Four other features bound a long list with a page size plus an explicit reveal,
in `renderer/src/features/workspace/ui/file-tree.tsx`,
`renderer/src/features/agent/ui/transcript/transcript.tsx`,
`renderer/src/features/agent/ui/chats/conversation-tree.tsx`, and
`renderer/src/features/retrieval/ui/managed-quick-open.tsx`. Applying the same
pattern to both lists is the fix, and it is cheaper than adding a windowing
layer.

**Known gap, the format registry has one carve-out.** Markdown retention is
still selected by name, in `retainMarkdownTabIds` and in the workspace's own
`md` test. Retention policy is genuinely Markdown-specific, so this is a
deliberate exception rather than an oversight, but it is the one place where
adding a format could require an edit outside its registry entry. Promoting
retention to a registry-declared capability would close it.

## Format-specific Behavior

- PDF renders from source bytes through pdf.js with a per-document worker.
  Each page pairs its canvas with the pdf.js text layer, so page text is
  selectable, copyable, and readable by assistive technology; the layer swaps in
  with the bitmap at every zoom level and is torn down with its page. Scale is
  bounded between `0.5` and `3`, fit-to-width tracks the scroller through a
  resize observer, and the reader's page is saved on the document runtime and
  restored on reactivation. Page tracking is throttled to one animation frame,
  and a jump is instant so it cannot fight the passive tracker. Worker, cmap,
  standard-font, and wasm URLs all derive from the versioned asset URL, so they
  keep folder identity. Font faces are disabled in favor of the bundled
  standard fonts. Two host proposals pdf.js expects are polyfilled structurally
  in `renderer/src/features/documents/ui/pdf/pdfjs-compat.ts`, loaded by both the
  main bundle and `renderer/src/features/documents/ui/pdf/worker.ts`. Find scans
  pdf.js text content rather than the DOM, folds dashes, quotes, and invisible
  spaces before matching, releases each page it scanned, and treats a damaged
  page as unsearchable rather than failing the document.
- DOCX fetches source bytes, converts and sanitizes in a renderer Worker, and
  falls back to the durable prepared preview after a `20 s` direct-preview
  deadline. A parse, fetch, or timeout failure keeps an explicit direct-preview
  warning with a retry above the fallback frame; it does not depend on or
  fabricate a preparation failure. The converter's own diagnostic travels as a
  cause and never reaches the reader. Direct DOCX is the second format that
  publishes an outline, derived from the sanitized article's headings through
  the shared slug allocator, and it claims Find through the shared rendered-prose
  controller.
- Local HTML is served into the sandboxed frame with the bootstrap the document
  needs for heading ids, anchor scroll, the in-frame Find half, and
  external-link forwarding. Injected chrome is a default rather than an
  override, so a page that styles its own scrollbars keeps them. The parent half
  of the Find protocol is
  `renderer/src/features/documents/ui/html/find-controller.ts`, which correlates
  replies by request id and settles an unanswered request after `2 s` rather
  than hanging the find bar. The frame is told the resolved theme on load and
  whenever the application theme changes. None of the injected chrome reaches
  the indexed plaintext.
- Image viewing has bounded zoom, fit and actual-size modes, ctrl or meta wheel
  zoom, and the shared lightbox for enlargement. It never turns the preview into
  an editable managed asset. The viewer itself carries no preparation state, so
  no recognizable OCR text is a normal image state and the warning belongs to the
  composed preparation row.
- Audio and supported video share one viewer through the media kind, which is
  also what selects the tab icon. Direct playback is attempted first; an
  unplayable source promotes a compatible preview and polls its status, and a
  fallback that also fails becomes a stated error rather than a silent dead
  player. The transcript follows preparation freshness and source time, polls
  while pending or blocked, and is published as a real WebVTT captions track so
  the player carries captions itself rather than depending on the list beside
  it.
- JSON shows a source-preserving tree beside the raw text, with one Find
  controller following whichever pane the reader is in. Strict, unique-key JSON
  at or below `512,000` UTF-8 bytes, `20,000` nodes, and depth `80` populates
  the tree; other input names its reason and leaves the source pane
  authoritative. Tree values retain raw token spans, and a structural edit
  splices only the affected value, property, or array range, so the tree never
  materializes the document through `JSON.parse` and never persists a serialized
  object. Prose typed into a cell becomes a JSON string, while anything that
  reads as JSON syntax must actually parse and says so when it does not. The
  tree is a treegrid whose arrow, Home, End, F2, and Delete contract is decided
  by the pure keyboard module beside it, and a match selects, expands to, and
  reveals its node. Both panes save through
  [File Transactions](file-transactions.md).
- TXT uses the shared code surface with an explicitly plain language, so a
  `.txt` is literal text and not code, with no Markdown, HTML, JSON, or link
  rendering. Valid UTF-8 sources share Find, versioned saves, and conflict
  recovery with the other editors.
- Every editable text source is normalized to LF line endings as it becomes
  editor text, in `renderer/src/features/documents/domain/document.ts`, and the
  save sends the editor's value. Saving a CRLF source therefore rewrites it with
  LF. This is deliberate and applies to Markdown, JSON, and TXT alike, but it
  means an untouched CRLF file can be rewritten by a save that the reader
  thinks changed one line.
- Generic strict-UTF-8 text opens read-only on the same surface and never
  registers an editor save handle. Unlike TXT it is syntax coloured, because a
  generic source is usually code. The grammar resolves from the source name
  through the CodeMirror language data set and loads on demand, an unrecognized
  or absent name renders uncoloured rather than guessing, and a grammar that
  resolves after its editor was destroyed is discarded instead of dispatched.
- Every CodeMirror surface takes its chrome from
  `renderer/src/features/documents/ui/code-editor/surface.ts`, so the JSON source
  pane, the TXT editor, and the generic viewer cannot drift in gutter, padding,
  selection, or active line. Token colours come from the one syntax palette in
  `renderer/src/shared/styling/code-highlight.ts` for the surfaces that colour at
  all.
- Viewer top chrome is one shared component,
  `renderer/src/features/documents/ui/viewer-toolbar.tsx`. A viewer with no top
  chrome fills from directly under the tab strip, because reserving the band for
  it exposes the pane's own background as a bright empty strip.

## Recovery Drafts

Unsaved editable text is journaled outside every library folder so an unclean
exit does not lose it. A journal write is never a save.

Every format that has an editor is journaled on equal terms, which is Markdown,
the JSON source pane, and plain text, because the journalist gates on the
presence of an editor rather than on a format name. A document opened from
another library folder is read-only, never gets an editor, and is never
journaled. Snapshots are debounced behind `RECOVERY_JOURNAL_DELAY_MS` with a
hard ceiling at `RECOVERY_JOURNAL_MAX_DELAY_MS`, so continuous typing is still
captured at a bounded interval. An entry is keyed by folder and relative path
alone, and the version the draft was typed over rides along as payload. Becoming
clean discards the entry, which is what a successful save does; the entry
survives a tab close on purpose, and a close that could not save keeps the tab
open rather than abandoning the draft.

Restoring loads the draft into the editor as unsaved text over the loaded
source, and answers whether it was restored, matched the disk text, or was
refused. It never writes the source. The restore path calls no save or write
endpoint, and a draft that turned out to equal disk clears its entry. What
reaches disk afterwards is the ordinary autosave through the existing save
barrier, carrying the draft's expected version as the base, so a draft typed
over older bytes meets the versioned conflict comparison instead of overwriting
silently. Staleness is also stated before the reader decides. An entry is
classified against the current disk version as current, changed, or missing, and
a changed or missing draft stays restorable. A restore waits for the source to
land and gives up after `DOCUMENT_RESTORE_WAIT_MS`, so a folder that went away
cannot hold the reader's decision open. A journal with no OS-protected key is a
named unavailable state, never an empty list.

The renderer half is `renderer/src/features/documents/application/recovery-runtime.ts`,
`renderer/src/features/documents/application/recovery-journalist.ts`,
`renderer/src/features/documents/domain/recovery.ts`,
`renderer/src/features/documents/infrastructure/recovery-draft-api.ts`, and the
reader surface `renderer/src/features/documents/ui/recovery/recovery-drafts.tsx`,
composed at `renderer/src/app/composition/folder/use-recovery-drafts.ts`. The
durable store and its privacy posture belong to
[File Transactions](file-transactions.md).

## Implementation Map

| Role | Stable entry points |
|---|---|
| Shared format vocabulary | `shared/file-formats.ts`, renderer classification in `renderer/src/features/documents/domain/document-format.ts`, server dispatch policy in `server/format.ts` |
| Viewer dispatch | `renderer/src/features/documents/ui/source/registry.tsx`, the contract `renderer/src/features/documents/ui/source/viewer.ts`, and the dispatcher `renderer/src/features/documents/ui/source/document.tsx` |
| Shared viewer frames | `renderer/src/features/documents/ui/source/asset.tsx`, `renderer/src/features/documents/ui/source/text.tsx`, `renderer/src/features/documents/ui/source/status.tsx`, `renderer/src/features/documents/ui/source/conflict.tsx` |
| Primary viewers | The entry modules under `renderer/src/features/documents/ui/source/viewers/pdf.tsx` and its siblings, over the implementations `renderer/src/features/documents/ui/pdf/document.tsx`, `renderer/src/features/documents/ui/docx/document.tsx`, `renderer/src/features/documents/ui/html/document.tsx`, `renderer/src/features/documents/ui/image/document.tsx`, `renderer/src/features/documents/ui/media/document.tsx`, `renderer/src/features/documents/ui/json/document.tsx`, `renderer/src/features/documents/ui/generic/document.tsx`, and the shared `renderer/src/features/documents/ui/code-editor/document.tsx` |
| Preview-control Modules | `renderer/src/features/documents/ui/pdf/use-pdf-document.ts`, `renderer/src/features/documents/ui/pdf/page.tsx`, `renderer/src/features/documents/ui/image/use-image-scale.ts`, `renderer/src/features/documents/ui/media/use-media-fallback.ts`, `renderer/src/features/documents/ui/media/use-media-transcript.ts`, `renderer/src/features/documents/ui/json/tree-model.ts`, `renderer/src/features/documents/ui/json/tree-keyboard.ts`, `renderer/src/features/documents/ui/code-editor/use-editor-session.ts` |
| Find and outline | `renderer/src/features/documents/application/navigation-runtime.ts` over the shared cursor `renderer/src/features/documents/application/find-cursor.ts`, with the per-surface controllers under `renderer/src/features/documents/ui/pdf/find-controller.ts`, `renderer/src/features/documents/ui/html/find-controller.ts`, `renderer/src/features/documents/ui/media/find-controller.ts`, `renderer/src/features/documents/ui/code-editor/find-controller.ts`, and `renderer/src/features/documents/ui/markdown/find-controller.ts` |
| Open-document state | `renderer/src/features/documents/application/tabs-runtime.ts`, `renderer/src/features/documents/application/document-runtime.ts`, `renderer/src/features/documents/application/queries.ts` |
| Worker and sanitizer Seam | `renderer/src/features/documents/infrastructure/docx-preview.worker.ts` and `shared/html-sanitization.ts` |
| Feature Adapters | `renderer/src/features/documents/infrastructure/adapters.ts` binding `asset-api.ts`, `source-api.ts`, `media-api.ts`, `docx-preview-api.ts`, `generic-preview-api.ts`, `recovery-draft-api.ts`, and `window-lifecycle.ts` in the same directory |
| Server asset and preparation Adapters | `server/routes/file-assets.ts`, `server/generic-file-preview.ts`, `server/docx.ts`, and media preparation Modules |
| Focused evidence | `renderer/src/features/documents/ui/source/registry.test.tsx`, `renderer/src/features/documents/ui/source/document-viewers.test.tsx`, `renderer/src/features/documents/ui/source/text.test.tsx`, the colocated viewer tests beside each implementation, `renderer/src/features/documents/infrastructure/docx-sanitization.test.ts`, and `server/generic-file-preview.test.ts` |

## Validation

Run:

```bash
pnpm typecheck
pnpm test:renderer
pnpm lint:web
pnpm build:web
pnpm test:library-files
pnpm test:conversion-scheduler
```

Add focused tests at the changed dispatch, decode, worker, trust, or navigation
Seam. A new format is proved by its registry entry plus its own viewer test;
`renderer/src/features/documents/ui/source/registry.test.tsx` already asserts
that every classifiable format resolves an entry and that the Find and outline
flags match the viewers that claim them, so a format added without an entry
fails there.

Journey automation and pixel baselines retired with the Playwright suites, so
prove viewer selection, valid fixtures, failure identity, navigation, or Find
changes with a driven runtime pass and review composition by eye. Packaged
complex PDF, DOCX, and media behavior plus native codec support remain release
checks.

Review at least one representative fixture for each behavior class rather than
inferring every capability from one extension: editable prose, editable
structured text, editable plain text, generic strict text, generic binary,
direct preview-only text, binary preview with prepared text, OCR image, and
transcript media. Extension aliases remain lower-level format detection
evidence.

Related journeys: [J03](../design-docs/user-journeys.md#j03-read-and-edit-source-documents)
and [J04](../design-docs/user-journeys.md#j04-prepare-a-hard-to-read-file).
Related contracts: [Markdown Rendering](markdown-rendering.md),
[File Transactions](file-transactions.md), [Data Lifecycle](data-lifecycle.md),
and [Renderer Workspace](renderer-workspace.md).
