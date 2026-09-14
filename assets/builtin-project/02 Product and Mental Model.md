# StashBase: Product and Mental Model

This guide describes the product on 2026-09-15 for people and Agents.

## The Short Answer

StashBase is an **IDE for writing**. Enter a local project, discuss an idea,
then develop it into writing. You can start with an empty folder or bring
existing references. Drafting, editing, and ordinary review already work;
document-specific diff for fine revision is coming soon.

```text
Enter a project → Brainstorm → Draft → Revise
                        ↑          ↕
              Optional references and search
```

Files remain ordinary local files. Preparation, indexing, retrieval, and Agent
access support the writing workflow without requiring a second proprietary
workspace, a wiki, or a completed index before discussion.

## Typical Work

- Explore an idea and decide what you want to say.
- Turn an outline into an article, proposal, or report.
- Read references and use their evidence in a draft.
- Revise wording, structure, and reasoning with an Agent beside the document.
- Reuse earlier drafts, research notes, and optional Wiki Pages in later work.

## Core Concepts

### Project and folder

A project is one ordinary local folder, possibly empty. It is the scope for
its documents, Chat, and search. The project registry remembers registered
folders; it does not combine them into a global search or knowledge library.
One project window works within its folder, and other projects can open in
other windows.

### Document and Source

A document can be a reference, draft, or finished piece. **Source** names its
role as the authoritative input for preview, retrieval, or Agent reading. A
new draft can become a source in later work. These roles do not create separate
storage types or require an import step.

### Agent Panel and Chat

Chat is the conversation surface of the Agent Panel. It can lead in an empty
project and sit beside a document as you write. OpenQuill is included; Claude
Code and Codex are alternatives. Each started Chat retains its scope. The
backend also retains an unbound scope for discussion and explicit project
creation, but Welcome does not expose it as a current user entry.

### Agent Instructions

Editable working guidance stored by StashBase for a project, separate from
runtime-native files such as `AGENTS.md`. The packaged project default helps
with discussion and requested writing. Saved changes apply to newly mounted
sessions, and clearing a customization restores the default. Instructions are
guidance, not a permission or filesystem security boundary.

### Document Workbench

The capability for browsing, reading, editing, and organizing local documents.
Each format has its own preview, editing, retrieval, and Agent access limits.
The same file remains authoritative across those surfaces.

### Preparation and derived data

Preparation makes difficult reference formats usable for retrieval or Agent
reading. Extracted text, OCR, transcripts, compatible previews, indexes, and
checkpoints are rebuildable application data. They stay outside the visible
project and never replace the original files.

### Keyword search and search by meaning

Keyword search finds known wording without setup. With an OpenAI or OpenRouter
key configured in Settings, you can also search by meaning. Both use one
project namespace and return evidence through visible source files. Search
is optional during discussion and does not define the product's identity.

### Wiki and Wiki Pages

A wiki is an optional collection of source-linked Markdown pages under a
project's `wiki/` directory. Ask an Agent to build or maintain it when useful.
An existing wiki's conventions apply; `wiki/index.md` is a common example,
not a mandatory entry filename. Wiki Pages are ordinary user-owned documents,
not derived data. A wiki request does not authorize reorganizing other files.

### Canvas

An optional role for a normal Markdown document holding accepted decisions,
open questions, and next steps. It is not a special file type, a whiteboard,
or an automatic transcript summary. You do not need a Canvas to write.

### Document-specific diff — Coming soon

Inline revisions preserve readable prose and formatting, with deletions shown
in red strikethrough and additions in green. The intended controls accept or
reject individual changes or the whole set. This experience is not available
yet. Existing Agent file diffs, file-write permissions, editor/disk conflict
comparisons, and saving are distinct capabilities.

## Ownership and Privacy

| Item | Owner and boundary |
|---|---|
| Project documents, drafts, and Wiki Pages | User-owned ordinary files on disk |
| Prepared text, previews, indexes, and status | Rebuildable StashBase application data |
| OpenQuill service access | StashBase sign-in and free Agent credits |
| Search by meaning | User's OpenAI or OpenRouter key in StashBase Settings; billed by that provider |
| Claude Code or Codex login and history | Selected runtime, separate from StashBase sign-in |

Local browsing, preview, editing, and keyword search need no cloud account.
PDF/image preparation downloads its local component when first needed; local
transcription requires a downloaded speech model. Once present, those
components process files locally. Choosing search by meaning may send text to
its provider. Using an Agent sends context to that Agent's model provider.
Local file ownership does not mean every optional capability runs offline.

StashBase MCP operations are bounded to authorized projects. Native Agents
have their own command, network, and filesystem permissions. Prompt guidance
never replaces those enforcement boundaries.

## What Makes Work Durable

Discussion is useful on its own. When the user asks to save an outcome, the
result is an ordinary document that can be reopened, searched, linked, or
edited by another tool. StashBase does not automatically turn a conversation
into project files or require a new knowledge-organization system.
