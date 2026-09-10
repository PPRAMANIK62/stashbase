# Documents

## User Outcome

People can read, inspect, edit, and navigate supported local source files while
the source remains the durable object shared with other tools and Agents.

## Scope and Non-goals

This area owns document tabs and format-appropriate reading or editing
experiences. Together with the Workspace area, it forms the Document
Workbench. It includes Markdown, literal UTF-8 plain text, source-authoritative
JSON, HTML, PDF, DOCX, images, audio, supported video containers, and truthful
fallback surfaces for other local files. Preparation and indexing are separate
areas.

StashBase is not an unrestricted browser, a script host, a pixel-perfect Word
editor, a media editor, or a proprietary document format.

## Current Experience

- Recent Markdown tabs retain ready surfaces across common switches; other tabs
  reopen through an explicit loading state. Activating a clean tab observes
  external changes, and failed opens remain identifiable and retryable.
- Markdown uses one Milkdown surface. Writer Mode and Reading View retain the
  same document model while changing the interaction boundary.
- Common Markdown structures, local assets, links, Find, outlines, and search
  navigation work without turning rendered output into source truth.
- A Markdown document may serve as a [Canvas](../glossary.md#canvas): Chat is
  for exploring, while accepted decisions are explicitly written into the
  ordinary source file.
- Valid JSON offers an accessible tree over the exact source text. Source mode
  remains available for malformed, incomplete, duplicate-key, or bounded-out
  content. Structured edits use the shared source-preserving save path rather
  than a second serialized document model.
- UTF-8 `.txt` sources use a literal source editor: Markdown, HTML, JSON, and
  link-like syntax remain text. Existing in-folder sources are editable, while
  out-of-folder results stay read-only. Unsupported encodings retain a visible
  source tab with an explicit error and are never rewritten.
- Other regular files remain selectable but muted in the tree because Search
  and automatic Chat context do not consume them. Selection performs bounded
  content inspection: strict UTF-8 text opens read-only, while binary,
  invalidly encoded, oversized, unavailable, and non-regular entries keep their
  source identity in an explicit cannot-open surface. Recognized source
  languages are syntax coloured for reading; an unrecognized one stays plain
  rather than being coloured as a guessed language. Reading such a file offers
  no editing chrome, because it is read-only.
- When a source changes on disk during an edit, StashBase keeps both versions,
  shows their differences, and waits for the user to reload, overwrite, or
  merge. An unresolved comparison blocks leaving; a merge returns as an
  unsaved draft.
- HTML is viewed as source content; the current compatibility preview executes
  local document scripts in a same-origin iframe. PDF uses its source document
  in the preview surface with selectable page text. DOCX uses a sanitized
  source-based preview with a
  prepared fallback; direct-preview failure remains explicit while that
  independently prepared fallback is pending or available. Image and media
  viewers keep source identity while adding format-appropriate navigation,
  playback, or transcript evidence.
- Safe workspace-relative links stay in StashBase. HTTP(S) links use the
  system browser. Markdown, DOCX, and Agent-rendered executable content stays
  inert.
- The file tree's Copy Link action puts a ready-to-paste Markdown link to a
  file on the clipboard, relative to the open note when one exists.
- The Markdown editor's slash menu offers a **Link to file…** item that
  inserts a ready Markdown link to a picked library file, relative to the
  open note; it is not offered on out-of-folder tabs.

## Format Capability Matrix

This is the canonical product-facing account of Shipping format behavior.
Capabilities are qualified using the [Glossary](../glossary.md#format-capability)
because preview, content editing, retrieval text, and Agent access are not
interchangeable. Exact extension membership is implemented by the shared
cross-process format vocabulary; tests own representative fixtures and
assertions.

| Source family | Extensions | Workbench surface | Workbench authoring | Retrieval text | Agent and MCP file access |
|---|---|---|---|---|---|
| Markdown | `.md`, `.markdown` | Writer Mode and Reading View | New notes and existing sources are content-editable | Direct source text | `read_file`, `write_file`, and `edit_file` use the source text |
| Plain text | `.txt` | Literal source editor | Existing sources are content-editable; New Note creates Markdown | Direct UTF-8 source text; unsupported encodings are excluded | `read_file`, `write_file`, and `edit_file` use valid UTF-8 source text |
| JSON | `.json` | Source-preserving Tree and Source views | Existing sources are content-editable; New Note creates Markdown | Direct source text | `read_file`, `write_file`, and `edit_file` use the source text |
| HTML | `.html`, `.htm` | Compatibility preview | Preview-only in the Workbench | In-memory text derived from the source without durable Preparation | `read_file`, `write_file`, and `edit_file` use raw HTML source |
| PDF | `.pdf` | Source PDF preview | Preview-only | Prepared Markdown | `read_file` returns current prepared Markdown; content writes are rejected |
| Image | `.png`, `.jpg`, `.jpeg`, `.webp` | Source image preview and lightbox | Preview-only; accepted imports create visible image sources | Prepared OCR evidence | Search consumes OCR; external MCP `read_file` does not return image bytes; an Agent Panel runtime may consume an explicitly supplied source image |
| DOCX | `.docx` | Sanitized source-based preview with a prepared fallback | Preview-only | Prepared HTML | `read_file` returns current prepared HTML; content writes are rejected |
| Audio | `.mp3`, `.wav`, `.m4a`, `.flac`, `.ogg`, `.opus`, `.aac`, `.aiff`, `.aif` | Source playback or compatible local audio preview | Preview-only | Prepared timestamped transcript Markdown | `read_file` returns the current transcript; content writes are rejected |
| Video container | `.mp4`, `.mov`, `.m4v`, `.webm`, `.mkv`, `.avi` | Media playback when compatible, otherwise a local audio preview | Preview-only | Audio track prepared as timestamped transcript Markdown | `read_file` returns the current transcript; content writes are rejected |
| Generic workspace file | Any other regular file, plus restricted filesystem entries | Strict UTF-8 text is read-only; otherwise an explicit binary, oversized, unavailable, symlink, special-entry, or cloud-placeholder state | No content editing | None; the muted tree state means Search and automatic Chat context exclude it | Not listed, read, written, moved, or deleted through Agent/MCP file tools |

Rename, move, and delete are file-mutation capabilities over regular files in
the active Workbench, including generic regular files; they do not make a
preview-only format content-editable or widen Agent access. Restricted
filesystem entries are reveal-only. Generic bytes are never decoded lossily.

`read_file` returns the whole readable text by default and, on request, one
declared line window of it, so a long source can be consumed a piece at a time
instead of spending an Agent's entire context in one call. A window is opt-in
and never silently substituted for a whole read.

## Experience Contract

- A visible source file is always the identity for tabs, links, search results,
  and Agent artifacts.
- Every format exposes only the capabilities in the matrix above. A
  preview-only source never shows a content-editing affordance, and a surface
  must not call prepared text the editable source.
- Muted generic-file styling always means the same thing: the file is visible
  in the Workbench but excluded from Search and automatic Chat context.
- Editable documents use the shared save/version path. An external-write
  conflict never silently overwrites either the dirty buffer or newer disk
  content.
- Reading and editing mode changes preserve selection, history, navigation,
  and unsaved content.
- Parsing or preview failure keeps the source identity visible and offers a
  truthful recovery path.
- Direct-text saves preserve supported UTF-8 BOM, line-ending, and trailing-
  newline conventions. Invalid UTF-8 is an explicit non-editable state, not a
  lossy replacement-character decode.
- A structured JSON view is a controller over source text, never a second
  document model or persistence path.
- A partial read announces itself, reports the source's full length, and offers
  the offset that continues it. It never carries a version token, so a window
  cannot be mistaken for the whole file by a later version-checked write.
- Rendering untrusted document content never grants application privileges or
  loads arbitrary remote resources.
- Product copy, Agent tool descriptions, and tests qualify format access by
  surface when Workbench and MCP capabilities differ.

## Known Gaps

- Executable local HTML and its remote subresources currently have a weaker
  boundary than the experience contract. The compatibility tradeoff and
  required confinement work are owned by
  [Document Viewers](../../code-review/document-viewers.md#trust-boundary).

## Cross-area Seams

- [Workspace](workspace.md) owns tabs, file operations, and window durability.
- [Preparation](preparation.md) owns derived text used by search and Agents.
- [Search](search.md) owns result evidence and navigation into a document.
- [Agent Panel](agent-panel.md) owns Agent response Markdown, which is a
  separate renderer from source-document Markdown.

## Contribution Direction

### Next

- Improve narrow layouts, large tables, image captions, and large-document
  continuity.
- Improve navigation continuity among outlines, anchors, Find, and search.
- Improve format-specific fallback and accessibility without hiding source
  identity.

### Coordinate First

- Schema, serializer, local asset, raw HTML, or link-handling changes.
- Save/version semantics or a new editable source format.
- Executable content, remote resource loading, or trust-boundary changes.

### Not Planned

- Replacing Markdown or JSON with a managed document model.
- Treating generated representations as user-managed source files.
- Turning preview into a general web or media editing environment.

## Related Journeys and Contracts

Journeys: [J03](../user-journeys.md#j03-read-and-edit-source-documents),
[J07](../user-journeys.md#j07-converge-chat-into-a-document), and the
[J10](../user-journeys.md#j10-turn-a-local-project-into-durable-agent-assisted-work)
core loop.

Contracts: [Markdown Rendering](../../code-review/markdown-rendering.md),
[File Transactions](../../code-review/file-transactions.md), and
[Document Viewers](../../code-review/document-viewers.md).
