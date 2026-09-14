# Using StashBase

Start with [Start Writing](../README.md#start-writing): enter a project,
brainstorm with an Agent, and begin drafting when ready.

## Choose a Folder and an Agent

The first window opens at Welcome. Open an existing folder, create an empty
project, import a public GitHub repository, or choose **Make a copy** in the
Gallery. Chat becomes available inside the project, even if it contains no
files. An entry's **Copy prompt** copies its build request for you to paste;
it does not start a conversation automatically.

**OpenQuill** is selected initially. Sign in to StashBase from the bottom of
the sidebar, or from **Settings → Agents**, to use its free credits, which
refill every seven days; no separate Agent installation or model API key is
required. You can instead select Claude Code or Codex.
Those runtimes use their own provider login; a missing runtime waits for
**Install and continue** before installation.

Start with an idea or question in the project's Chat. When ready, ask the
Agent to create an outline or draft, or write directly in a new document.
References and search are available when useful; neither a wiki nor a
completed index is required to brainstorm.

For a source-filled project, [Build Your First Wiki](../README.md#build-your-first-wiki)
is an optional way to organize references. Search always targets one project,
and wiki maintenance runs only when requested.

A fresh default folder home also receives **Start Here**, a folder of local
product and troubleshooting guides. Open it from Welcome / Recent and ask its
Chat **“How do I use StashBase?”**

## Read and Work Alongside Chat

Selecting a source opens it alongside the same conversation. The Files sidebar,
persistent tabs, and format-specific viewers let you browse, read, and edit
supported files directly.

- **Cmd/Ctrl+O:** find and open a file in the active folder.
- **Cmd/Ctrl+Shift+P** or **F1:** open the Command Palette.
- **File → New Window** or **Cmd/Ctrl+Shift+N:** work in another window.
- **Cmd/Ctrl+W:** close the active document tab.
- **@ mentions in Chat:** find a file or folder and insert its relative path.

Tool calls and file edits can be reviewed in Chat. Use **Agent Instructions**
in the composer to customize guidance for its scope. Saved changes apply to
newly mounted Chat sessions; an existing mounted session keeps its original
instructions. StashBase stores the setting without creating or rewriting
`AGENTS.md` or `CLAUDE.md` in your folders.

Drafting, editing, Agent file-change reports, and save-conflict comparisons are
available now. [Document diff — Coming soon](../README.md#document-diff--coming-soon)
will add inline suggested revisions in the prose with individual and whole-set
accept/reject; those controls are not currently available.

Some files can be listed without being searchable or editable. Muted files
are excluded from Search and automatic Chat context. Preview, editing,
retrieval text, and Agent file access vary by format; see the canonical
[Format Capability Matrix](../design-docs/design/documents.md#format-capability-matrix).

## Turn On Search by Meaning

Keyword search needs no account or API key and is on from the start. Search
by meaning, which finds files even when the wording differs, is off until you
add an OpenAI or OpenRouter key under **Settings → Search by Meaning**. The
key is billed to you and is used only for search by meaning; signing in to
StashBase does not turn it on.

Once the key is saved, StashBase prepares registered projects and keeps their
search index synchronized, and the search panel gains a **By meaning** mode
beside **By keyword**. Removing the key turns it off again. This background
work is separate from an Agent writing visible Wiki Pages. An OpenAI
restricted key needs embedding access for `text-embedding-3-small`;
model-list access is not required.

Search covers direct text in supported Markdown, UTF-8 plain text, HTML, and
JSON files, plus prepared text from PDFs, DOCX files, images, and recordings.
Results point back to the visible source file. Some material needs preparation
before it can appear; Search reports readiness, and failed preparation can be
retried.

Agents search the same way: text matching always, including prepared
document text, plus meaning-based evidence once a key is on.

OpenQuill's free credits have nothing to do with search. Check the account
menu at the bottom of the sidebar or **Settings → Agents** for the remaining
percentage and refill date.

## Prepare Recordings

For audio or video transcription, download a local speech model from
**Settings → Transcription**. Small (465 MiB) is the default; Tiny (74 MiB) and
Base (141 MiB) use less space. Transcription runs on your machine without a
transcription API cost and produces searchable timestamped text.

Original media remain the visible files. They play directly when supported;
otherwise, StashBase creates a compatible local audio preview. Extracted text
and previews remain app-managed data. See
[Preparation](../design-docs/design/preparation.md) for format behavior.

## Manage Access

Apart from the bundled Start Here introduction, folders join the project registry only
when you explicitly add or open them, including making a Gallery copy.
Removing a folder clears StashBase's state for it without deleting its files.

For an external Agent client, keep StashBase running and register the
configuration from **Settings → MCP**. See
[MCP Configuration](mcp-configuration.md) for setup and access boundaries, and
[Your Files and Your Data](../README.md#your-files-and-your-data) for local and
cloud processing boundaries.
