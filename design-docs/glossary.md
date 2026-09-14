# Glossary

Use these terms consistently in product copy, design docs, review contracts,
and tests. Implementation identifiers may retain established names when a
rename would not improve the user-facing model.

## Naming During Review

Start with the meaning and scope, then inspect the name. Product copy, Agent
Instructions, and guides use the vocabulary here. Code identifiers may use
established technical terms; renaming a persisted field, protocol, or path
requires checking its readers, writers, and migration behavior first.

| Earlier wording | Current meaning |
|---|---|
| StashBase as a Wiki or knowledge base | IDE for writing; wiki building is an optional project task |
| Library as a global knowledge/search scope | Separate local projects; the registry remembers membership only |
| Folder / project | Folder names the filesystem directory; project names the user's working scope |
| Source as reference material only | Any authoritative document input, including an earlier draft |
| Canvas as a required output | An optional role of an ordinary Markdown document |
| Similarity / exact search in product copy | Search by meaning / keyword search |
| Search allowance / credits | Search uses the user's provider key; free credits belong to OpenQuill |
| Diff without qualification | Distinguish implemented file/conflict comparisons from the coming-soon document-specific diff |

A naming finding should say whether it changes wording, reveals incorrect
behavior or scope, or is a necessary compatibility name. Keep findings in the
review record rather than turning this glossary into a source inventory.

## IDE for writing

The product identity: a local project environment for discussing ideas with an
Agent and developing them into writing. Project entry, brainstorming, drafting,
revision, and ordinary review are implemented. Document-specific diff is the
remaining feature described in [Product Direction](product-direction.md).

## Brainstorming

Exploring an idea, question, or possible direction in a project Chat. It may
use existing references, but an empty project is valid. Discussion is useful
without immediately creating a document or committing to an outline.

## Document

An ordinary user-owned file being read or worked on. It can be reference
material, a draft, or a finished piece; these are roles, not separate storage
types. Format capabilities determine whether its body can be edited.

## Document-specific diff

The coming-soon inline revision experience for prose: preserve document
formatting, show deleted words or phrases with red strikethrough and additions
in green, and let the user accept or reject individual changes or the full
set. It is a tracked-changes reading experience, rather than a line-oriented
source-code patch. Existing Agent file diffs and editor/disk conflict
comparisons are implemented separately. The feature is not yet available;
reviewing a suggestion, approving an Agent action, and saving a file remain
distinct concepts. See [Product Direction](product-direction.md#document-specific-diff--remaining-feature).

## Active-folder workspace

The renderer-owned working context for one currently opened local folder:
visible files, tabs, document durability, retrieval readiness, and refresh
lifecycle. It excludes shell presentation and Agent conversation state.

Avoid: `global store`, `app state` when this narrower meaning is intended.

## Agent Panel

The Agent capability for working against an explicit project or
folder scope. **Chat** is the Agent Panel's visible conversation surface: it
leads before a document is opened and docks beside the Document Workbench when
a source is active. The Agent Panel may run OpenQuill, Claude Code, or
Codex; it is not itself synonymous with any runtime.

## Agent Instructions

The user-visible, editable guidance StashBase stores for Chat. A plain-language
packaged default applies to every Chat. Each scope has its own default and its
own optional customization in application metadata: a concrete working folder,
or an unbound conversation. Exactly one scope applies to a Chat, and scopes
never combine. Runtime Adapters preserve this text while
composing a separate internal Agent runtime policy that is not exposed in the
editor. A save applies to Chats that start after it; a Chat whose session is
already mounted keeps the text it started under. It is guidance, not a
security boundary.

`AGENTS.md`, `CLAUDE.md`, and other runtime-native instruction files remain
ordinary user-owned runtime inputs. StashBase neither creates nor rewrites
them, and does not call those files Agent Instructions in product UI.

## OpenQuill

The included zero-install Agent shown as **OpenQuill** in Agent pickers and Chat
chrome. It uses StashBase's pinned local OpenCode runtime and the signed-in
account's **free credits**, which refill on a fixed seven-day window. Sign-in
lives in the account row at the foot of the sidebar and in the Agents section
of Settings, and exists for OpenQuill alone. `stashbase` remains its
implementation identifier.

## Search by meaning

The user-facing name for optional meaning-based retrieval inside one project.
When an embedding key is added under Settings, it combines vector similarity
with text matching and always returns evidence through a visible Source. It
is off until then, and no surface names it before it is on. Keyword search,
always-available exact text matching, works without it; once a key is on, the
search panel's mode toggle pairs **By meaning** with **By keyword**.

Write the name as a plain phrase: lowercase in running copy ("set up search
by meaning", "preparation for search by meaning"), and title-cased **Search
by Meaning** only where the surrounding chrome title-cases sibling labels
(such as the Settings tab). Keep the phrase after a verb or preposition.
Never make it the subject of a finite verb — sentence-initial "Search by
meaning isn't…" reads as an imperative. Recast such sentences as an action
("Set up search by meaning") or use the gerund ("Searching by meaning stops
until a key is added").

Search by meaning has no hosted quota: the key's provider bills the person
who added it, and StashBase shows no credits for search. **Credits** names
OpenQuill's free seven-day quota only: **Free credits** under the Agents
section, where the section already says whose they are, and **OpenQuill
credits** in the sidebar — the signed-out row's own label and the signed-in
account menu's credits line — where nothing around either says whose they are.
`allowance` survives as the wire and type name behind it, never in product
copy.

The mode labels are **By keyword / By meaning**; the full names are **keyword
search / search by meaning**. They describe the user's intent. Engineering
uses **grep** for literal matching and **hybrid** for combined text and vector
retrieval; search by meaning is not a claim of vector-only search.

An Agent lookup without an explicit mode uses keyword search until an embedding
key is configured, then searches by meaning. Explicit modes retain their
meaning, including an error when meaning-based retrieval is requested without
a key. There is no per-Chat search switch. Selecting keyword search for a
lookup does not pause or delete background search data. Describe background
work as preparing or updating files for search by meaning.

## Wiki

An optional collection of source-linked pages within one project, created or
maintained through an explicit Agent task. It helps organize references and
support later discussion and writing. Wiki is not the name of the entire
product, the project registry, or a global retrieval scope.

## Wiki Pages

Visible Markdown under a folder's `wiki/` directory. Current packaged
Instructions specify that directory and preserve an existing wiki's conventions;
they do not mandate an entry filename. Requests and examples may use
`wiki/index.md`. Wiki Pages organize and explain Sources through relative
links. They are ordinary user-owned files,
not hidden StashBase derived data, and they re-enter browsing, search, and
future Agent work.

Use **Build Wiki** for the explicit folder-scoped request that asks an
Agent to create or improve these pages from Sources. The request never grants
permission to move, rename, delete, or broadly rewrite Sources.

Use **Gallery** for the curated shop of ready-made Wikis. Every entry is a
real folder with a wiki built from it, downloadable as a copy that opens in
its own window. The welcome screen a window with no folder open shows
carries the Gallery band under its folder choices; the sidebar's Gallery row
raises the same shop as an overlay inside a folder window. An entry's detail
page carries the publisher's introduction to the wiki and, as its Agent
Instructions, the request that built it. The **Copy** glyph on those instructions is its one prompt affordance,
and the Gallery never places or sends composer text.

## Canvas

A role played by a normal user-visible Markdown document that holds the
accepted state of long-running human-Agent work: confirmed decisions, live
alternatives, open questions, and next focus. Conversation may branch, but only
conclusions explicitly written back become part of the Canvas.

Canvas is not a separate file type, editor, automatic transcript summary, or
whiteboard.

## Document Workbench

The product capability for browsing, reading, editing, navigating, and
organizing documents across ordinary local folders. It combines the Workspace
and Documents product areas. A **workspace** may still name the current window
or folder context; it is not a competing name for the whole capability.

## Preview tab

A document tab opened by browsing: a single click in Files, a search hit, a
link, Quick Open, or a file named in a Chat. Its name is set in italics, a
window holds at most one, and the next browse reuses it in place. A tab that
is not a preview is a **kept tab**. A preview becomes kept on a double click,
on Enter, or on its first edit, and only kept tabs are restored on relaunch.
Say "preview tab" and "kept tab"; the product does not say "pinned".

## Document history

The window's record of the documents visited in the open folder, in visiting
order, stepped by the back and forward arrows in the sidebar's titlebar band
(and in the workspace titlebar while the sidebar is collapsed) while the
sidebar is in Documents mode; in Chats mode the same arrows step the open
Chats instead. It lists files, not tabs, so it can return to a
preview that was replaced.

## Draft

A Markdown file a person starts from the New tab's **Create new draft**: created
as `Untitled.md` beside the selection, opened at once as a kept tab, and
handed its name in the tree, where the new row starts a rename with the stem
selected. Distinguish it in copy from the *recovered drafts* of unsaved text
a previous session left, which [Documents](design/documents.md) owns.

## Format capability

The user-observable operations available for one source format. Avoid the
unqualified words `supported`, `readable`, and `writable` when the distinction
matters. Use the narrow capability instead:

- **Previewable** — the visible source opens in a format-appropriate Workbench
  surface.
- **Content-editable** — the source body can be changed through a named surface
  and the shared versioned save boundary.
- **Direct-text readable** — retrieval or an Agent reads useful text from the
  source itself without durable Preparation.
- **Prepared-text readable** — retrieval or an Agent reads only a current
  derived representation produced by Preparation.
- **Agent-readable** — a named built-in or external Agent surface can consume
  the source or its current derived representation. Name the surface when
  built-in attachment and external MCP behavior differ.
- **File-mutable** — the visible source can be renamed, moved, or deleted. This
  does not imply that its contents are editable.
- **Retrieval-eligible** — Search and automatic Chat context may consume direct
  or current prepared text for the source. A muted generic file is explicitly
  not retrieval-eligible even when its bytes can be shown read-only.

Creating a new text source, importing a binary source, previewing it, editing
its contents, and mutating its file identity are separate capabilities. The
canonical Shipping matrix lives in the
[Documents area](design/documents.md#format-capability-matrix).

## Generic workspace file

An ordinary file visible in the active-folder tree that has no declared
retrieval format. Selection may inspect it as bounded strict UTF-8 text or show
an explicit unavailable placeholder, but it remains outside Search, automatic
Chat context, Preparation, and Agent/MCP file access. The muted tree treatment
communicates this capability boundary; it does not mean the file is missing.

## Derived data

Rebuildable text, assets, indexes, checkpoints, and status records that
StashBase creates from source files. Derived data stays outside the visible
workspace and never replaces source-file identity. Do not use this term for
visible, user-owned Wiki Pages.

## Project

One ordinary local folder opened in StashBase, possibly empty. It gives a
discussion and its files a shared working scope. Its root identifies the project
and its independent search namespace. Search, preparation, and Agent file work
operate within that project; empty results never widen to another project.
The project registry remembers opened folders, favorites, and authorization.
It is a directory of projects, not a global knowledge or retrieval scope.

## Unbound Chat

A conversation without a project. It can discuss and plan, but cannot search
or read project files until a project is opened or explicitly created. Existing
unbound history retains its storage location. The current welcome screen does
not expose this conversation entry; see the Agent Panel's Known Gap.

## Local RAG layer

The supporting capability that turns authorized project documents into
source-grounded Agent context for discussion and writing. It combines Preparation with exact and
meaning-based retrieval. **Local** describes ownership of sources, derived
state, and index lifecycle; configured embedding capacity may be hosted.

Searching by meaning is the optional retrieval capability inside this layer,
not a synonym for the whole layer.

## Preparation

Format-specific work that makes a source usable for search or Agent reading,
such as PDF extraction, image OCR, DOCX text derivation, or media
transcription. Preparation and readiness for search by meaning are separate
states.

## Product scenario

A durable, high-level reason someone uses StashBase. A scenario explains
motivation and desired outcome; it does not prescribe screens or test steps.

## Source

A user-owned file as the authoritative input to preview, preparation,
retrieval, or an Agent read. A newly written draft can become a source for later
work; a source need not be an imported reference. Prepared evidence resolves
to that file, and source-linked wiki pages cite it. The technical use of source
identity does not turn all writing into a separate reference library.

## User journey

A stable user outcome identified by `Jxx`, with an observable flow, required
results, and evidence. Primary and supporting Shipping flows are distinguished
from a retained secondary route whose entry is unavailable. An ID alone does
not claim that a flow is reachable or fully proven.
