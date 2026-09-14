# Getting Started and Workflows

This guide begins after installation and reflects the application on 2026-09-15.

## Enter a Project

A window without an open project shows Welcome. Open an existing folder,
create an empty project, import a public GitHub repository, or make a Gallery
copy. Opening another project uses its own window. Chat becomes available
inside a project; there is no current in-app entry for an unbound conversation.

A pristine default folder home receives `👋 Start Here`, this ordinary guide
folder, without opening it automatically. Existing homes and existing guide
copies are not overwritten. To ask about StashBase, open Start Here from
Welcome / Recent and ask its Chat, "How do I use StashBase?"

## Brainstorm, Then Write

1. Open or create a project. An empty folder is enough.
2. Choose an Agent. OpenQuill is included and selected initially; sign in to
   StashBase to use it. Claude Code and Codex use their own provider login;
   a missing runtime requires **Install and continue**.
3. Describe your idea, audience, or question. Explore alternatives and develop
   an outline when useful. Sources, search, and a wiki are optional.
4. When ready, ask the Agent to write a draft into a project file, or create a
   new draft and write it yourself.
5. Read and revise it alongside Chat. Inspect tool activity and file changes,
   and respond to any permission requests from the selected runtime.
6. Reopen and continue the saved document later. It remains an ordinary file
   usable by other tools and Agents.

Discussion does not automatically create a document. Agent-created files
refresh the workspace without forcing them open or changing your focus.
Opening a document can dock the same Chat beside it without restarting the
conversation. Resolving runtime setup keeps the draft; send it when ready.

Drafting, editing, and ordinary revision are available. **Document-specific
diff is coming soon**: readable prose with deleted words struck through in red,
additions in green, and accept/reject for each change or the whole set. Existing
Agent file diffs and editor/disk conflict comparisons are separate features.

## Set Working Guidance

Use **Agent Instructions** in the composer to save guidance for the current
scope. The project default supports brainstorming, requested drafting and
revision, source-backed answers, and optional wiki work. A saved customization
applies to newly mounted sessions; an already mounted Chat keeps its original
instructions. Clearing the customization restores the packaged default.

StashBase stores these settings outside the project. It does not create or
rewrite runtime-native `AGENTS.md` or `CLAUDE.md` files. The retained backend
unbound scope has separate instructions, but is not an entry from Welcome.

## Work Locally with Existing Documents

1. Open a project and select a document.
2. Read it in the format-specific viewer, or edit a content-editable format.
3. Search for known wording with keyword search; results return to the visible
   source. No account, embedding key, or Agent is needed.

Folder entry and ordinary preview do not wait for background Preparation or
indexing. Some formats need prepared text before their contents can be found.
See `03 Capabilities and Boundaries.md` for the differences between viewing,
editing, searching, and Agent access.

## Add Search by Meaning When Useful

Keyword search works from the start. To find related material even when its
wording differs, add an OpenAI or OpenRouter key under
**Settings → Search by Meaning**. The provider bills that key; StashBase
sign-in and OpenQuill credits do not configure or pay for search.

Once configured, the search panel offers **By meaning** alongside **By keyword**.
Preparation and indexing run in the background. Each query stays inside one
project; an empty result never widens it to other projects. Removing the key
turns meaning-based retrieval off while keyword search remains available.

## Build a Wiki When It Helps

Wiki building is an optional Agent request in an open project, not a required
step before brainstorming or writing. For example:

> Build a source-linked wiki under wiki/. Use wiki/index.md as its entry page.
> Preserve the files outside wiki/.

The default guidance places Wiki Pages in `wiki/` and follows existing
conventions; `index.md` is an example filename, not a required product format.
Inspect the resulting ordinary Markdown files. Wiki work does not authorize
reorganizing or broadly rewriting the source files. It uses the same Agent
readiness, permissions, and file operations as other requests and does not
require setting up search by meaning.

Gallery provides ready-made project copies as another starting point. Copying
an entry's prompt only puts text on the clipboard; it does not send a request.

## Use Difficult Reference Formats

- Preview PDF and DOCX while their searchable representations are prepared.
- PDF extraction and image OCR download their local component automatically
  when first needed. A failed download stops for this session; the next app
  launch retries once. **Settings → General → Local components** offers Retry.
- For audio or video transcription, download a speech model under
  **Settings → Transcription**. Transcription runs locally.
- Prepared text and compatible previews stay in application data. The original
  visible file remains authoritative and available when Preparation fails.

## Connect an External Agent

StashBase configures MCP for its included Agent and activated supported native
runtimes. For another MCP-compatible client, use **Settings → MCP** and keep
StashBase running while the client connects. External clients receive bounded
operations over registered projects, not unrestricted host filesystem access.
They still select one project for each search.

## Return Later

Project registration, settings, and started Agent history persist. A new window
begins at Welcome; it does not silently select a project. Reopen the project
and its saved files or conversations. Local file work remains available when
an optional provider or Agent is unavailable.
