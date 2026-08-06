# Markdown document runtime

> Code review contract for the shared Milkdown CrepeBuilder Markdown surface.
> Product intent is in [design-docs/design/markdown.md](../design-docs/design/markdown.md).

Markdown files remain the source and index input. Opening a note parses it into
one CommonMark + GFM Milkdown document. Writer Mode changes the retained
document's interaction boundary; Reading View is the same editor schema and
theme with native editing disabled and authoring controls hidden. The
application serializes the document through Milkdown and writes Markdown by
using the existing save/version/error path. Do not reintroduce a separate
CodeMirror Markdown editor, HTML preview, or iframe document surface.

## Ownership

- CrepeBuilder owns the editor schema and maintained authoring UI: block/slash
  controls, contextual selection toolbar, lists, link tooltip, images, tables,
  code blocks, cursor behavior, placeholder, and LaTex. Do not restore a
  persistent formatting toolbar; the empty-document prompt directs writers to
  type `/` for available blocks.
- StashBase owns tab lifecycle, saving, conflict/version handling, local asset
  storage, local navigation, image lightbox, Find, anchors, search highlighting,
  app styling, and the trust boundary.
- Theme integration uses semantic StashBase tokens plus a scoped Milkdown token
  bridge. Milkdown's frame stylesheet assigns its variables directly on its
  root, so inherited app tokens alone are insufficient: keep the bridge more
  specific than the package selector and map its menus, placeholders, tooltips,
  and code blocks to the active light/dark roles. Crepe uses its outline token
  for contextual-toolbar and slash-menu glyphs, so those controls need explicit
  inactive, hover, and active colors rather than inheriting the subtle border
  role.
- The Agent-message Markdown renderer remains separate from document Markdown.

## Integration invariants

- Autosave reads the current Milkdown serializer value through the registered
  editor handle. A read-only document never registers a save handle. A
  successful save acknowledgement advances only the open tab's version. It
  must never feed submitted or server-returned Markdown back into the active
  editor, since either content update can recreate code-block node views and
  selection.
- External source refreshes use Milkdown's `replaceAll` macro and suppress the
  resulting listener callback. A React rerender with unchanged incoming content
  must never overwrite active typing.
- `refreshDocumentDom` is a source-refresh decoration pass, not a transaction
  listener. Never run it from `markdownUpdated`: mutating Milkdown's DOM while
  CodeMirror owns a code-block node view detaches its focus and selection.
- App-level Find and search chunk highlighting are scoped to the document root,
  never the surrounding application UI. They must continue to work after mode
  switches and document replacements. Match navigation scrolls the document's
  own scroller, rather than the renderer window.
- Heading IDs derive from rendered heading text and remain stable enough for
  same-note and cross-note anchor navigation.
- Document outlines read heading nodes from the retained ProseMirror document.
  Keep live extraction and active-section tracking outside transaction-time DOM
  decoration; outline IDs must share the anchor slug allocation. Outline
  selection re-resolves the retained heading node against the current
  ProseMirror document position rather than trusting a stale absolute position
  or mutable rendered DOM ID. Node object identity is a candidate, not a unique
  document key: one immutable node may occur at multiple positions, so repeated
  identity matches must be disambiguated with the current outline entry before
  navigation calls the live view. Selection then scrolls Milkdown's actual
  document scroller directly instead of using a generic ancestor-scrolling
  call. The sidebar consumes transient outline state; it must not parse or
  retain a second document model.
  Collapsing an entry filters only its deeper following heading entries and
  never mutates the retained document.
- Relative images resolve below the opened note's `/asset/` base. Image upload
  writes through the existing folder-scoped upload endpoint, then returns an
  encoded note-relative Markdown path; rendering resolves it only in the DOM.
  Do not use Crepe's remote-upload examples or credentials. Do not expose the
  generic image URL input or load remote image URLs, including network-path
  (`//host/path`) references.
- Relative Markdown links navigate inside the app. Decode path segments only
  after splitting, reject empty/dot/parent/embedded-separator segments, ignore
  non-note workspace assets, and hand only original HTTP(S) URLs to the system
  browser. The edit and preview popovers share one compact, viewport-safe
  width. The link field must keep its URL-or-note-path guidance readable, and
  switching between states must not resize the surrounding document.
- Preserve valid leading YAML frontmatter verbatim outside the Milkdown body.
  GitHub alert source remains ordinary blockquote Markdown and receives only a
  DOM presentation treatment; neither feature introduces a second serializer.
- Image activation stays within the shared app lightbox. Code blocks never
  execute, regardless of language label.
- Do not add scripts, arbitrary embeds, remote document state, or AI features
  to the editor; the Agent panel is the application AI surface.

## Validation

Run `pnpm typecheck`, `pnpm test:renderer`, and
`npx vite build --config web-src/vite.config.ts`. Add focused tests for local
link validation, serialization/refresh behavior, document-scoped Find, and
local image path derivation whenever those seams change. Manually verify a
Markdown document in the running Electron app in both Writer Mode and Reading
View, including the slash menu, tables, code blocks, math, and link
handling.
