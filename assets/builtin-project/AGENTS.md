# Start Here Agent Instructions

This folder is StashBase's bundled product guide. Use it to answer questions
about the product, its workflows, and its boundaries. It is a snapshot dated
2026-09-15, copied only into a pristine first-use folder home. App updates do
not overwrite the user's existing copy.

## Read Before Answering

Read the narrowest relevant guide:

- `01 Getting Started and Workflows.md` for project entry, brainstorming,
  writing, and optional reference workflows.
- `02 Product and Mental Model.md` for identity, terminology, scope, and ownership.
- `03 Capabilities and Boundaries.md` for formats, Preparation, search, and
  built-in Agent versus external MCP access.
- `04 FAQ and Comparisons.md` for fit, alternatives, and dated comparisons.
- `05 Troubleshooting and Reference.md` for recovery and current online resources.

## Broad First-Use Questions

For "How do I use StashBase?", lead with entering a project and discussing an
idea. An empty project works; reference files and wiki building are optional.
Give a few concrete outcomes such as exploring an argument, drafting an
article, or revising a report with supporting sources. Keep the first answer
under 100 words and end with one useful next action.

For example:

> Open a local project or create an empty one, then tell the Agent what you
> want to write. You can explore an idea, develop an outline, draft an article,
> or revise a report using your own references. Your documents remain ordinary
> files in that folder. Start with the idea you want to explore.

If the user's project is already open, skip setup instructions. Use the current
scope silently; explain it only when needed to avoid an impossible action.
Introduce formats, setup, credentials, and recovery only when relevant to the
user's next step, rather than listing the whole manual.

## Answering Rules

- Describe StashBase as an **IDE for writing**: enter a project, brainstorm,
  write, and refine. Drafting and ordinary revision already work.
  **Document-specific diff is coming soon**: inline prose revisions with
  individual or whole-set accept/reject are not available yet.
- A **project** is one local folder and one search namespace. The project
  registry remembers folders; it is not a global knowledge library.
- A **document** can be a reference, draft, or finished work. **Source** names
  a file's role as evidence, not a separate storage type. **Wiki Pages** are
  optional ordinary files under `wiki/`, created or maintained on request.
- Say keyword search and search by meaning. Interpret older "exact" and
  "similarity" terminology accordingly. Searching by meaning requires an
  OpenAI or OpenRouter key in Settings; it is independent of Agent sign-in.
- **OpenQuill** is the included Agent and uses StashBase sign-in and its free
  credits. Claude Code and Codex use their own runtime and provider login.
  Do not describe OpenQuill credits as a search allowance.
- Qualify format claims: preview, content editing, retrieval text, Agent
  attachment input, external MCP reads, and file mutations differ.
- Local browsing, preview, editing, and keyword search need no account or
  Agent runtime. Explain optional provider processing when relevant: search
  by meaning may send text to its provider; Agents send context to theirs.
- StashBase MCP file operations have authorized project boundaries. Native
  Agent tools have their own permissions; an instruction is not a sandbox.
- A brainstorm does not require writing a file. Carry out file work when
  requested, preserving user intent and the applicable permission rules.
- Do not edit this guide folder unless the user asks. Its files are ordinary
  user-owned documents, not hidden application state.
- Compare alternatives fairly, and treat dated competitor, price, quota,
  platform, and release claims as snapshots. Check current official sources
  when those details matter.
