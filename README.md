# StashBase

**Your personal knowledge, retrievable by AI.**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.12-brightgreen.svg)](https://nodejs.org/)
[![Powered by mfs](https://img.shields.io/badge/powered%20by-mfs-0891b2.svg)](https://github.com/zilliztech/mfs)
[![Status](https://img.shields.io/badge/status-early%20alpha-orange.svg)](#)

A local-first knowledge base for notes, papers, transcripts, and saved analysis.

Use it from coding agents like Claude Code or Codex through MCP. StashBase indexes your library as it grows, so AI tools can retrieve knowledge by meaning instead of repeatedly loading entire folders into context.

![Demo](.github/assets/demo.gif)

> Demo: Claude Code reshapes a raw podcast transcript into question cards (my preferred reading format). StashBase indexes the notes automatically so the ideas become searchable later while chatting with AI.

---

## Semantic search for personal knowledge

Most AI tools treat knowledge as temporary context: uploaded files, chat history, copied notes, local indexes.

But personal knowledge lasts longer. Papers, notes, transcripts, and saved analysis accumulate over time, scattered across folders and apps.

StashBase is a local knowledge base built for that long-lived knowledge.

It indexes your library once and makes the relevant pieces retrievable later through semantic search — from coding agents, desktop AI clients, or MCP workflows.

```text
   Claude · ChatGPT · Codex
              │  (MCP)
              ▼
  ┌────────────────────────────┐
  │  StashBase                 │
  │  semantic + keyword search │
  │  embeddings · MCP tools    │
  └────────────────────────────┘
              ▲
              │
   HTML notes · papers ·
   podcasts · saved analysis
```

A focused Markdown / HTML editor lives in the app, but the retrieval layer is the point — every note is indexed as it lands and stays reachable from any MCP-aware AI tool.

Example query:

```text
Query:
"why do companies keep paying for SaaS?"

→ notes/saas-maintenance.html
   Software is only part of the cost.
   Reliability, upgrades, permissions,
   integrations, and support are usually
   the harder problem.
```

Instead of repeatedly loading entire folders into context, StashBase indexes your library once and retrieves only the relevant pieces when needed.

StashBase uses [mfs](https://github.com/zilliztech/mfs) under the hood for local semantic indexing and retrieval. mfs itself is built on Milvus Lite.

Hybrid retrieval is enabled by default: dense vector kNN fused with BM25 through Milvus's `RRFRanker(k=60)`.

One round-trip. No client-side merge.

---

## MCP integration

Use the same knowledge library from Claude Code, desktop AI clients, or custom MCP workflows.

Example Claude Desktop configuration:

```json
{
  "mcpServers": {
    "StashBase": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/StashBase/mcp/server.ts"]
    }
  }
}
```

Available tools:

* `search_kb`
* `list_files`
* `get_file`
* `index_status`

Example workflows:

```text
Index this folder

Search my notes for "vector retrieval vs keyword search"

Open the matching note
```

---

## Built-in agent workspace

Beyond MCP as the front door, a few things make running a coding agent *against* a StashBase space a first-class workflow rather than a side-by-side workaround:

* **In-app terminal** — Claude Code and Codex are pre-wired. The PTY launches in the current space, and the file watcher picks up anything the agent writes — sidebar tree refreshes, the open preview re-renders. (That's the demo gif at the top.)

* **Skills** — drop a `skills/<name>/SKILL.md` into a space and StashBase mirrors it into `.claude/commands/<name>.md` and `.codex/prompts/<name>.md`. Write a slash command once, use it across both CLIs.

* **Cross-file link cascade** — rename a note and StashBase rewrites every Markdown / HTML link pointing at the old path, with a VS Code-style "Update N references in M files?" confirmation. Reorganize without breaking what the AI has already filed away.

* **PDF → HTML** — drop a PDF in and the marker pipeline produces a readable, indexable HTML note + assets bundle.

* **Git clone as a space starter** — point the Welcome screen at a repo URL; StashBase clones, opens, and indexes in one step.

---

## Current focus

StashBase is currently optimized for knowledge-heavy workflows:

* notes
* papers
* podcasts
* saved analysis
* AI-generated artifacts

Codebase retrieval is already well served by tools like [Claude Context](https://github.com/zilliztech/claude-context), so StashBase focuses more on the rest of what accumulates around AI work.

Browser history, activity traces, and passive memory capture are intentionally out of scope for now.

---

## Why HTML

Markdown became the default not because it was more expressive, but because it was the lowest-friction format humans were willing to type.

That tradeoff changes once models are generating most of the structure.

To an LLM, HTML and Markdown are both just text. But HTML carries richer structure for long-lived knowledge: semantic sections, anchors, embedded media, tables, expandable blocks, and layouts that survive outside any single app.

For retrieval systems, that structure matters.

Markdown still makes sense for drafts and quick notes. StashBase supports both side by side — the "+" button in the sidebar pops a small picker so you choose format at creation time. HTML sits at the top because it's the recommended choice for anything meant to outlive a chat session.

> "HTML is the new markdown. I've stopped writing markdown files for almost everything and switched to using Claude Code to generate HTML for me."
>
> — Thariq Shihipar ([Anthropic, Claude Code](https://x.com/trq212/status/2052809885763747935))

> "Ask your LLM to structure your response as HTML."
>
> — [Andrej Karpathy](https://x.com/karpathy/status/2053872850101285137)

---

## Quick start

```bash
# Setup
cd StashBase
pnpm install
pnpm setup:python

# Run
pnpm electron
# or
pnpm dev

# Build
pnpm dist:mac
```

Two embedding providers are supported per space:

* **OpenAI** (`text-embedding-3-small`, 1536d)
  Used by default when an API key is available.

* **Local ONNX** (`bge-m3`, 1024d)
  Fully local after the first download.

Embedding configuration is locked per space after the initial index build.

---

## Spaces

Each selected folder becomes a "space".

Every space gets its own `.stashbase/mfs/` sidecar containing a local semantic index powered by [mfs](https://github.com/zilliztech/mfs).

Files are scanned and indexed automatically on boot. External edits — from editors, git checkouts, sync tools, or coding agents — are picked up through filesystem watching.

---

## Status

Early alpha.

macOS receives the most testing today. Windows and Linux generally work but are less exercised.

On-disk schemas and APIs may still change between commits.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

Small focused PRs are preferred. Open an issue before larger changes so scope and direction can be discussed first.

---

## About

StashBase is a personal side project by [Li Liu](https://www.linkedin.com/in/cmuliliu/), built alongside work on [Milvus](https://github.com/milvus-io/milvus) at [Zilliz](https://zilliz.com).

Not a Zilliz product.
