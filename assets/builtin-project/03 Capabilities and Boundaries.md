# Capabilities and Boundaries

This is the detailed product-facing capability reference bundled on
2026-09-15. Use the narrow capability names below: preview, Workbench content
editing, retrieval text, Agent/MCP access, and file mutation are not
interchangeable.

## Format Capability Matrix

| Source family | Workbench surface | Workbench content editing | Retrieval text | Agent and external MCP file access |
|---|---|---|---|---|
| Markdown (`.md`, `.markdown`) | Writer Mode and Reading View | New and existing Markdown is content-editable | Direct source text | `read_file`, `write_file`, and `edit_file` use source text |
| Plain text (`.txt`) | Literal source editor | Existing valid UTF-8 sources are content-editable; Create new draft creates Markdown | Direct UTF-8 source text; unsupported encodings are excluded | `read_file`, `write_file`, and `edit_file` use valid UTF-8 source text |
| JSON (`.json`) | Source-preserving Tree and Source views | Existing JSON is content-editable; Create new draft creates Markdown | Direct raw source text | `read_file`, `write_file`, and `edit_file` use source text |
| HTML (`.html`, `.htm`) | Compatibility preview | Preview-only in the Workbench | Clean text derived in memory from the source | MCP file helpers use raw HTML source text |
| PDF (`.pdf`) | Source PDF preview | Preview-only | Prepared Markdown | `read_file` returns current prepared Markdown; content writes are rejected |
| Image (`.png`, `.jpg`, `.jpeg`, `.webp`) | Source image preview and lightbox | Preview-only; imports create visible image sources | Prepared OCR evidence | External MCP `read_file` does not return image bytes; an Agent Panel runtime may consume an explicitly supplied source image |
| DOCX (`.docx`) | Sanitized source-based preview with prepared fallback | Preview-only | Prepared HTML | `read_file` returns current prepared HTML; content writes are rejected |
| Audio (`.mp3`, `.wav`, `.m4a`, `.flac`, `.ogg`, `.opus`, `.aac`, `.aiff`, `.aif`) | Source playback or compatible local audio preview | Preview-only | Prepared timestamped transcript Markdown | `read_file` returns the current transcript; content writes are rejected |
| Video (`.mp4`, `.mov`, `.m4v`, `.webm`, `.mkv`, `.avi`) | Media playback when compatible, otherwise a local audio preview | Preview-only | Audio track prepared as timestamped transcript Markdown | `read_file` returns the current transcript; content writes are rejected |
| Generic workspace file (every other format) | Strict UTF-8 text opens read-only; binary, invalid encoding, oversized, unavailable, symlink, special, and cloud-placeholder entries keep an explicit cannot-open surface | No content editing | None; the muted tree state means Search and automatic Chat context exclude it | Not listed, read, written, moved, or deleted through Agent/MCP file tools |

Rename, move, and delete are Workbench file-level mutations over regular
visible sources, including generic files. They do not make a preview-only
format content-editable or widen Agent access. Restricted filesystem entries
are reveal-only, and generic bytes are never decoded lossily.

## Document Workbench

- The tree shows ordinary files instead of filtering unknown formats. Generic
  rows are muted because Search and automatic Chat context exclude them.
- Dependency and generated-output directories are visible as non-expandable
  excluded rows; StashBase does not traverse their contents. Derived
  artifacts and dot-directories remain hidden infrastructure.
- Files open with format-appropriate surfaces. Browsing uses a reusable preview
  tab; keeping or editing it makes it a kept tab that can be restored later.
- Markdown Writer Mode and Reading View use the same underlying source.
- JSON Tree and Source views preserve the exact raw source, including malformed
  or duplicate-key content in Source view.
- Quick Open includes every file visible in the active tree and carries the
  same generic-file explanation. The Command Palette exposes existing safe
  application actions.
- Find, outlines, local links, history, and search results navigate back to
  source identity.
- Search or Agent links to a file in another project folder open read-only
  without silently switching the current folder.
- A source changed externally during editing produces a visible conflict. The
  dirty buffer is not silently overwritten.

## Document-specific Diff — Coming soon

Drafting, content editing for the formats above, Agent file diffs, and
editor/disk conflict comparisons are available. Inline prose revisions with
red strikethrough deletions, green additions, and individual or whole-set
accept/reject are not available yet. This does not imply Word-compatible
editing or broaden the content-editable format set.

## Preparation

Preparation creates the representation needed for retrieval or Agent reading:

- Markdown, valid UTF-8 plain text, and JSON use source text directly.
- HTML provides clean in-memory retrieval text without a durable prepared file.
- PDF produces Markdown.
- DOCX produces HTML.
- Images produce OCR evidence.
- Audio and supported video produce timestamped transcript Markdown.

Prepared text, compatible media previews, checkpoints, and indexes stay in
StashBase application data. They never appear as extra workspace files.
Agent-authored `wiki/` pages are different: they are visible,
ordinary user-owned Markdown sources.

Preparation runs in the background and does not block folder entry or ordinary
preview. A result counts as current only when the format-specific work is
complete and matches the current source bytes. Failed, stale, partial, or
cancelled output is not presented as current truth.

PDF extraction and image OCR download their local component in the background
when first needed. A failed download stops for the app session, retries once
on the next launch, and can be retried explicitly under
**Settings → General → Local components**. Once installed, it works offline.

Audio and video transcription is optional. It runs locally after the user
downloads a speech model under **Settings → Transcription**.

## Search

### Keyword Search

Keyword search is exact literal text matching — the search popup's
**By keyword** mode. It never needs setup. It searches direct Source text and
any current prepared text that is ready.

### Search by Meaning

Searching by meaning — the search popup's **By meaning** mode — finds related
material even when the query and Source use different wording.

Add an OpenAI or OpenRouter key under **Settings → Search by Meaning** to
turn it on. The provider bills that key. StashBase account sign-in and
OpenQuill credits are independent of search; there is no hosted search allowance.
Without a key, keyword search remains available. Once a key is configured,
the panel offers **By meaning** beside **By keyword**.

The search panel searches only the active project. Empty results never widen
the search to another project.
Results always identify visible source files, even when their evidence came
from PDF extraction, DOCX conversion, OCR, or a transcript. A missing result
may mean wrong scope, wrong mode, incomplete Preparation, files still being
prepared for search by meaning, provider failure, or provider billing limits; those are not
equivalent conditions.

## Agent Panel Chat

- The built-in panel runs OpenQuill, Claude Code, or Codex. OpenQuill is
  included and initially selected; its model service requires StashBase sign-in.
- Welcome opens a project before exposing Chat. An empty project can brainstorm
  and write without a wiki or reference lookup.
- A missing Claude Code or Codex runtime waits for explicit **Install and
  continue**. Resolving setup preserves the draft without sending it.
- Claude Code and Codex use their own provider authentication. OpenQuill uses
  StashBase sign-in and free credits. Neither configures search by meaning.
- Each project Chat has its own scope. A started draft, turn, attachment set,
  or restored conversation is never silently rebound to another project.
- Opening a source docks the same mounted Chat beside it; it does not create a
  second conversation.
- `@` searches workspace files and folders, then inserts only the selected
  workspace-relative path. That path helps the scoped Agent locate a source;
  it does not attach bytes or promise that every Agent surface can consume the
  format. File picking, drag/drop, and composer-focused paste are separate
  explicit context actions.
- Tool activity and proposed file changes remain inspectable.
- Commands, network, deletion, and broader filesystem access remain explicit
  permission decisions when the runtime requests them.
- Session history remains in the Agent CLI's normal storage.

## External MCP Access

While StashBase is running, compatible clients can use the same authorized
projects through MCP; each search selects one project.

Common operations include:

- `list_projects` for registered projects and the status of search by meaning;
- `search_project` for keyword search or search by meaning with explicit
  narrowing;
- `reindex` for external disk changes;
- `create_project` for a new ordinary folder under an authorized location;
- bounded `list_directory`, `read_file`, `write_file`, `edit_file`,
  `move_file`, and `delete_file` helpers.

These helpers exist for sandboxed Agents that cannot directly access host
files. Paths outside registered projects and hidden derived data remain
inaccessible. Search narrowing fails rather than silently widening. File
content reads and writes follow the format matrix above.

Configure external clients under **Settings → MCP**. The StashBase app must
remain running because it owns the local MCP server.

## Credentials and Optional Services

Keep these separate when explaining setup or recovery:

| Capability | Credential owner |
|---|---|
| OpenQuill | StashBase account session and free Agent credits |
| Search by meaning | OpenAI or OpenRouter key stored through StashBase Settings |
| Build Wiki | The selected OpenQuill, Claude Code, or Codex Agent; no separate credential |
| Agent Panel Claude Code | Claude runtime/provider authentication |
| Agent Panel Codex | Codex runtime/provider authentication, including the runtime's ChatGPT sign-in flow |
| External MCP client | That client's account plus the StashBase MCP connection configuration |

No credential should be requested through an environment variable as the
normal StashBase setup path.

## Folder and Data Lifecycle

- Adding or opening a folder registers that ordinary directory as one project;
  it does not migrate its files or combine it with other search namespaces.
- Adding or opening a folder never creates or edits `AGENTS.md`, `CLAUDE.md`, or
  another instruction file. Use **Agent Instructions** in the composer for
  project guidance stored by StashBase. The retained backend unbound scope has
  its own default and customization; there is no current in-app entry for it.
- Folder entry prioritizes navigation while Preparation and indexing continue
  in the background.
- Removing a folder from the project registry saves active edits, clears StashBase-owned
  derived/index/runtime state and folder-scoped Agent Instructions for that
  member, and leaves the source folder and its files on disk.
- Deleting a source is a separate explicit destructive operation.
- Generated representations never appear in the file tree or search results as
  independent sources.
