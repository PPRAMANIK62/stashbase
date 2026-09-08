# Using StashBase

Start with [Build Your First Wiki](../README.md#build-your-first-wiki) for the
short path from a folder to Wiki Pages and Agent work.

## Choose a Folder and an Agent

The first window opens with a blank Chat and a Gallery of ready-made Wikis.
Choose **Make a copy** in an entry to download its folder and open it in a new
window, or use **Open Folder…** for your own material. When an entry includes
its build request, **Copy prompt** lets you reuse it on another folder.

**Wiki Agent** is selected initially. Sign in to StashBase to use its included
model allowance, which has a seven-day window; no separate Agent installation
or model API key is required. You can instead select Claude Code or Codex.
Those runtimes use their own provider login; a missing runtime waits for
**Install and continue** before installation.

Chat can work across the Library or within a selected folder. Use a Chat
scoped to your folder when asking an Agent to build or update its Wiki. The
request creates or improves `wiki/index.md` and focused pages under `wiki/`
while preserving Sources outside that directory. Ask again when you want
updates; Wiki maintenance is not automatically scheduled.

A fresh default folder home also receives **Start Here**, a folder of local
product and troubleshooting guides. Open it from the titlebar's **Library**
menu, or ask a Library Chat **“How do I use StashBase?”**

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
in the Chat toolbar to customize guidance for its scope. Changes apply from
the next message and are stored by StashBase; this does not create or rewrite
`AGENTS.md` or `CLAUDE.md` in your folders.

Some files can be listed without being searchable or editable. Muted files
are excluded from Search and automatic Chat context. Preview, editing,
retrieval text, and Agent file access vary by format; see the canonical
[Format Capability Matrix](../design-docs/design/documents.md#format-capability-matrix).

## Set Up Search by Meaning

Keyword search needs no account or API key. The first folder you activate also
offers search by meaning, with StashBase sign-in and included monthly credits
or your own OpenAI/OpenRouter key. Choose **Not now** to defer. Return through
**Set up** in the Files panel, **By meaning** in Search, or
**Settings → Search by Meaning**.

With setup complete, StashBase prepares Library folders and keeps their search
index synchronized. This background work is separate from an Agent writing
visible Wiki Pages. An OpenAI restricted key needs embedding access for
`text-embedding-3-small`; model-list access is not required.

Search covers direct text in supported Markdown, UTF-8 plain text, HTML, and
JSON files, plus prepared text from PDFs, DOCX files, images, and recordings.
Results point back to the visible source file. Some material needs preparation
before it can appear; Search reports readiness, and failed preparation can be
retried.

In Chat, the **Search by meaning** switch is inside the scope picker. Turning
it off keeps text matching available, including prepared document text, and
does not pause background preparation or indexing.

Hosted indexing and meaning-based queries share monthly credits. Check the
account menu or Settings for the remaining percentage and reset date. When
credits run out, keyword search and local file workflows remain available.
Wiki Agent's model allowance is separate from these search credits.

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

Apart from the bundled Start Here introduction, folders join the Library only
when you explicitly add or open them, including making a Gallery copy.
Removing a folder clears StashBase's state for it without deleting its files.

For an external Agent client, keep StashBase running and register the
configuration from **Settings → MCP**. See
[MCP Configuration](mcp-configuration.md) for setup and access boundaries, and
[Your Files and Your Data](../README.md#your-files-and-your-data) for local and
cloud processing boundaries.
