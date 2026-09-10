# Markdown Rendering

> Code review contract for the Milkdown `CrepeBuilder` Markdown surface.
> Product intent is in [design-docs/design/documents.md](../design-docs/design/documents.md).

Markdown files remain the source and the index input. Opening a note parses it
into one CommonMark and GFM Milkdown document. Writer Mode and Reading View are
the same retained editor, the same schema, and the same theme, differing only in
whether native editing is enabled and authoring controls are visible. The
application serializes through Milkdown and writes Markdown along the existing
save, version, and error path. Do not reintroduce a separate CodeMirror Markdown
editor, an HTML preview, or an iframe document surface.

## Ownership

- `renderer/src/features/documents/ui/markdown/document.tsx` builds one
  `CrepeBuilder` per tab and is the only module that does. It composes exactly
  nine Crepe features, which are the placeholder, cursor, list item, link
  tooltip, block edit, toolbar, table, CodeMirror code block, and LaTeX. The
  code block is handed the CodeMirror language data set, so a fenced block
  colours by its language label. Crepe owns the editor schema and that
  maintained authoring UI. Do not restore a persistent formatting toolbar; the
  empty-document prompt directs writers to type `/` for available blocks.
- StashBase owns tab lifecycle, saving, conflict and version handling, local
  navigation, Find, anchors, the outline, app styling, and the trust boundary.
- Retained surfaces are bounded.
  `MAX_RETAINED_MARKDOWN_SURFACES` in
  `renderer/src/features/documents/domain/markdown.ts` caps how many open
  Markdown tabs keep a mounted `CrepeBuilder`, and `retainMarkdownTabIds`
  advances the MRU as a pure function so the policy is testable without React.
  Older inactive surfaces are evicted and remount on reactivation behind the
  explicit opening state. Only the active surface may claim the save handle,
  the Find controller, the outline, or pending anchor work, and every claim is
  held against an owner symbol so a departing surface cannot clear a newer
  one's. Closing a tab destroys its builder.
- Theme integration uses semantic StashBase tokens through a scoped Milkdown
  token bridge in
  `renderer/src/features/documents/ui/markdown/document.css`. Crepe's frame
  stylesheet assigns its variables directly on its own root, so inherited app
  tokens alone are insufficient and the bridge must stay more specific than the
  package selector. Crepe reuses its outline token for contextual-toolbar and
  slash-menu glyphs, so those controls carry explicit inactive, hover, and
  active colours rather than inheriting the subtle border role.
- The Agent-message Markdown renderer remains separate from document Markdown.

## Integration invariants

- Autosave reads the current Milkdown serializer value through the registered
  editor handle. A read-only document never registers a save handle. A
  successful save advances the open tab's version and retains the accepted
  source for a later reactivation.
- While a document is dirty its mounted editor ignores incoming retained source,
  so an older in-flight acknowledgement cannot recreate node views or overwrite
  newer live edits. Once clean, the retained source already equals the editor
  value. The initial source counts as observed when the builder is created,
  before the editor becomes interactive, so a rerender with unchanged content
  can never overwrite active typing.
- An external source refresh uses Milkdown's `replaceAll` macro with the
  resulting listener callback suppressed until the following microtask, which is
  also when heading extraction reruns. Never mutate Milkdown's DOM from
  `markdownUpdated`. Doing so while CodeMirror owns a code-block node view
  detaches its focus and selection.
- Crepe creation has explicit creating, ready, and failed states. The editor
  shell stays non-paintable until ready, and a creation failure replaces it with
  an actionable retry rather than an indefinite blank pane. A builder whose
  creation rejected while Milkdown is still in `OnCreate` must not enter
  Milkdown's retrying destroy path, which is what
  `renderer/src/features/documents/application/markdown-editor-lifecycle.ts`
  exists to guarantee; retry uses a fresh builder.
- Reading View hides every authoring overlay at the scoped style boundary even
  when a retained Crepe provider still reports its previous visible state.
  Package styles load after the StashBase document stylesheet, so the selectors
  that suppress maintained Crepe controls must outrank their package rules.
- Find is scoped to the document root and never the surrounding application UI.
  Matches are located in the flattened text of the live DOM and painted with CSS
  custom highlights, so highlighting never mutates the document on screen. The
  query, options, and cursor position live in the shared
  `renderer/src/features/documents/application/find-cursor.ts`, which
  re-enumerates before every move so an edit made with Find open cannot leave
  the cursor on a match that no longer exists. Milkdown rewrites the rendered
  tree as the reader types, so a mutation observer coalesces those bursts into
  one re-enumeration per microtask. Match navigation scrolls the document's own
  Milkdown scroller rather than the renderer window.
- Heading ids derive from rendered heading text and are allocated once.
  `extractDocumentHeadings` in
  `renderer/src/features/documents/ui/markdown/outline-adapter.ts` walks the
  retained ProseMirror document, slugs each heading through `headingSlug` in
  `renderer/src/features/documents/domain/outline.ts`, and de-duplicates with a
  numeric suffix. That one array is both stamped onto the DOM and published to
  the outline, so anchor targets and outline entries cannot drift.
- Outline extraction and active-section tracking stay outside transaction-time
  DOM decoration. Outline selection re-resolves the retained heading node
  against the current ProseMirror document rather than trusting a stale absolute
  position or a mutable rendered id. Node object identity is a candidate and not
  a unique document key, because one immutable node may occur at several
  positions, so repeated identity matches are disambiguated against the current
  entry's position and text before navigation calls the live view. Selection
  then scrolls Milkdown's actual scroller directly instead of using a generic
  ancestor-scrolling call, and honours reduced motion. The sidebar
  `renderer/src/features/documents/ui/workspace/outline.tsx` consumes transient
  outline state and its own collapse set; it must not parse or retain a second
  document model, and collapsing an entry never mutates the retained document.
- Valid leading YAML frontmatter is preserved verbatim outside the Milkdown
  body. `splitLeadingYamlFrontmatter` in
  `renderer/src/features/documents/domain/markdown.ts` splits it before the
  builder is created and re-prefixes it on every serialization, so no second
  serializer exists and a frontmatter block Milkdown does not model survives
  byte for byte. A block that does not parse as YAML is left in the body rather
  than being guessed at.
- Relative Markdown links navigate inside the app through the single resolver
  `renderer/src/features/documents/domain/link-target.ts`, shared with the DOCX
  and HTML viewers. It rejects an absolute path, a network path, a non-HTTP(S)
  scheme, a credential-bearing URL, and any segment that is empty, dot, parent
  beyond the folder root, undecodable, separator-bearing, or control-bearing,
  and it decodes each segment only after splitting. A surviving relative target
  resolves against the owning document's own folder, so a link inside a document
  from another library folder opens in that same folder and, because access is
  folder-relative, opens read-only. Only an original HTTP(S) URL is handed to
  the system browser, and a host that refuses to open one says so rather than
  leaving the click looking successful.
- Do not expose a generic image URL input or load remote image URLs, including
  network-path references. Do not use Crepe's remote-upload examples or
  credentials. Code blocks never execute regardless of language label. Do not
  add scripts, arbitrary embeds, remote document state, or AI features to the
  editor; the Agent panel is the application AI surface.
- Agent-facing `write_file` and `edit_file` mutations validate the complete
  replacement source before persistence, in
  `server/library-file-mutations.ts`. C0 controls other than tab, line feed, and
  carriage return are refused without changing the existing file, because those
  bytes commonly signal that an interpreted JavaScript string consumed LaTeX
  escapes. The refusal names the code point and the fix. Valid literal
  backslashes remain byte for byte unchanged.

## Trust Boundary

Document Markdown renders through the Milkdown schema as structured node trees
and never through a raw HTML string. There is no `dangerouslySetInnerHTML` on
this path and no iframe. Sanitized-HTML trust, the DOCX worker seam, and
executable local HTML are [Document Viewers](document-viewers.md) concerns.

### The Milkdown find seam is the one approved double-cast exemption

`renderer/src/features/documents/ui/markdown/find-controller.ts` may use
`as unknown as`. It is the only place in the renderer that may, and today it is
also the only place that does. The three occurrences in that file are the only
`as unknown as` in all of `renderer/src`.

Two casts are earned. Find walks the live DOM the editor renders, and
`FindCorpusNode` is a hand-written structural mirror of the four node members
the walk actually reads, which is what lets the corpus builder be exported and
unit-tested with no DOM at all. A structural mirror is not assignable from the
real `HTMLElement` and `Text`, so crossing into it and back out again takes a
double cast. The third is a guarded capability probe. Find paints with CSS
custom highlights, and neither the highlight registry on `window` nor the
`Highlight` constructor is declared by the project's DOM library, so the cast
describes the shape the code then checks for at runtime before using it.

Confining the casts to this file is what keeps the rest of the renderer honest.
A double cast anywhere else is a defect, not a precedent, and a reviewer should
treat a new one as a design question about the type it is evading. The casts
carry no explanatory comment in the source, so this contract is their record.

## Known Gaps

**Note-relative assets do not resolve in a Markdown document.** The Markdown
registry entry asks for no asset service, nothing under
`renderer/src/features/documents/ui/markdown/` constructs an asset URL, and the
only asset URL builder in the renderer,
`renderer/src/features/documents/infrastructure/asset-api.ts`, serves the
byte-backed viewers that the Markdown viewer never mounts. A relative image path
therefore reaches the DOM as authored and resolves against the renderer document
instead of the folder-scoped `/asset` route. Consequently there is also no image
upload, no note-relative encoded path returned from one, and no path from a
Markdown image to the shared lightbox, which is reachable only from the image
viewer's own toolbar. The Required behavior is that a relative image below the
opened note resolves through the folder-scoped asset base and is activated into
the shared lightbox by pointer and keyboard alike. A fix needs the asset service
on the Markdown entry, resolution in the DOM only rather than in the serialized
source, and coverage for an out-of-folder note whose images must inherit its
folder identity rather than the window's active folder.

**Heading ids are stamped by position, not matched.** `applyHeadingIds` pairs
the Nth rendered heading element with the Nth extracted heading and performs no
id or position cross-check. Any divergence between the DOM heading order and the
ProseMirror traversal order would silently mislabel anchors. Cross-checking each
element against its heading node would close it.

**The code-block active-line paint is unconditional.** Every code block in a
document at rest shows a band across its first line. The paint and the shared
code surface that also carries it are recorded once, in
[Document Viewers](document-viewers.md).

## Implementation Map

| Role | Stable entry points |
|---|---|
| Document Interface | `renderer/src/features/documents/ui/markdown/document.tsx`, reached through the registry entry `renderer/src/features/documents/ui/source/viewers/markdown.tsx` over the shared `renderer/src/features/documents/ui/source/text.tsx` |
| Editor lifecycle | `renderer/src/features/documents/application/markdown-editor-lifecycle.ts` |
| Markdown Modules | `renderer/src/features/documents/domain/markdown.ts` for frontmatter and retention, `renderer/src/features/documents/ui/markdown/outline-adapter.ts` for heading extraction and outline scrolling, `renderer/src/features/documents/domain/outline.ts` for slug allocation and outline nesting, `renderer/src/features/documents/domain/link-target.ts` for link resolution |
| Find Interface | `renderer/src/features/documents/ui/markdown/find-controller.ts` over the shared cursor `renderer/src/features/documents/application/find-cursor.ts`, claimed through `renderer/src/features/documents/application/navigation-runtime.ts` |
| Trust Interface | Milkdown schema rendering in `renderer/src/features/documents/ui/markdown/document.tsx`, plus the double-cast exemption above; sanitized-HTML trust is a [Document Viewers](document-viewers.md) concern |
| Save and conflict Adapter | `renderer/src/features/documents/application/document-runtime.ts`, `renderer/src/features/documents/hooks/use-document-source.ts`, `renderer/src/features/documents/infrastructure/source-api.ts` |
| Workspace Adapter | `renderer/src/features/documents/ui/workspace/workspace.tsx`, `renderer/src/features/documents/ui/workspace/outline.tsx`, `renderer/src/features/documents/ui/workspace/find.tsx`, and the composition in `renderer/src/app/composition/folder/` |
| Styling | `renderer/src/features/documents/ui/markdown/document.css`, the migration's one component-specific CSS exception, mapping Crepe anatomy onto semantic tokens |
| Agent-facing mutation guard | `server/library-file-mutations.ts` |
| Focused evidence | `renderer/src/features/documents/ui/markdown/document.test.tsx`, `renderer/src/features/documents/ui/markdown/find-controller.test.ts`, `renderer/src/features/documents/application/markdown-editor-lifecycle.test.ts`, `renderer/src/features/documents/domain/markdown.test.ts`, `renderer/src/features/documents/domain/outline.test.ts`, `renderer/src/features/documents/domain/link-target.test.ts`, `renderer/src/features/documents/ui/source/document-markdown.test.tsx`, `renderer/src/features/documents/ui/workspace/outline.test.tsx` |

## Validation

Run:

```bash
pnpm typecheck
pnpm test:renderer
pnpm lint:web
pnpm build:web
```

Add focused tests at the changed parsing, serialization, trust, navigation, or
document-lifecycle Seam. Run `pnpm test:electron:smoke` for retained-tab and
native lifecycle changes, and `pnpm test:library-files` when the agent-facing
mutation guard changes.

Journey automation and pixel baselines retired with the Playwright suites, so
prove a user-visible Markdown journey change with a driven runtime pass and
review composition by eye. When no deterministic automated interaction exists,
verify the affected behavior manually and add the lowest practical regression.
Executable source HTML remains a separate
[Document Viewers](document-viewers.md) concern.

Related journeys: [J03](../design-docs/user-journeys.md#j03-read-and-edit-source-documents)
and [J07](../design-docs/user-journeys.md#j07-converge-chat-into-a-document), plus
the [J10](../design-docs/user-journeys.md#j10-turn-a-local-project-into-durable-agent-assisted-work)
core loop.
Related contracts: [Document Viewers](document-viewers.md),
[File Transactions](file-transactions.md), and
[Renderer Workspace](renderer-workspace.md).
