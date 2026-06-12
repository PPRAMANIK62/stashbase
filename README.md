# StashBase

**Turn what you save into persistent memory.**

[![Website](https://img.shields.io/badge/website-stashbase.ai-0a66c2.svg)](https://stashbase.ai)
[![Status](https://img.shields.io/badge/status-early%20alpha-orange.svg)](#status)
[![Node](https://img.shields.io/badge/node-%3E%3D22.12-brightgreen.svg)](https://nodejs.org/)
[![Powered by mfs](https://img.shields.io/badge/powered%20by-mfs-0891b2.svg)](https://github.com/zilliztech/mfs)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Discord](https://img.shields.io/badge/Discord-support%20%26%20chat-5865F2.svg?logo=discord&logoColor=white)](https://discord.gg/F7vtfTVf)

> ⭐ **If this idea interests you, drop a star.** Every item on the [build map](https://stashbase.ai/build-map/) ships with detailed design — easy to pick up if you'd like to contribute.

StashBase is a local-first knowledge base that turns documents, screenshots, videos, and AI artifacts into persistent memory for you and your AI. You stash it. Agents organize and maintain it.

📥 **Capture what matters:** Import documents, folders, and AI artifacts — or capture anything you've seen on your screen: screenshots get a searchable text layer, screen recordings become structured notes.

🤖 **One memory, every AI:** Claude, ChatGPT, Codex — every MCP client draws on the same knowledge base.

💾 **Local-first & user-owned:** Your original files stay on your disk in open formats. No vendor lock-in. Your memory remains portable and under your control.

---

## 🚀 Demo

![Demo](.github/assets/demo_0521.gif)

> Import the CS183B starter — 20 YC startup lectures, embeddings included. Surface ideas in Claude Desktop via `@stashbase`, then use the built-in agent (Claude Code) to organize what resonates into HTML notes.

---

## ⚡ Try it

StashBase currently ships for **macOS (Apple Silicon)** — Windows / Linux are on the [roadmap](#status). Install with Homebrew:

```bash
brew install --cask liliu-z/stashbase/stashbase
```

Once the app is running:

1. Start with the CS183B starter — Stanford's 20 startup lectures, embeddings included:
   ```bash
   git clone https://github.com/0-bingwu-0/stashbase-cs183b
   ```
   Then on the Welcome screen: **Import folder** → pick the cloned `stashbase-cs183b`.
2. Open **Settings → MCP**, click **Connector** for your AI client, restart that client, then ask `@stashbase what's the best time to start a startup?`.
3. Then bring your own: hit **New space** and drag in your files — Markdown, HTML, PDFs, images — or record your screen and get back a structured note.

**Embeddings.** StashBase asks for an OpenAI API key when you open your first space — used **only for embeddings** (no chat completions). `text-embedding-3-small` is only $0.02 per 1M tokens. [Create a key.](https://platform.openai.com/api-keys) Without a key, files still save, preview, and stay searchable by exact keyword — only semantic search waits for the key.

**Recordings.** Screen recording turns what you watched into a structured note via Gemini video understanding — the original video stays attached, playable inside the note. Needs a Gemini API key — add one under **Settings → Capture**. [Create a key.](https://aistudio.google.com/apikey) `gemini-2.5-flash` runs about $0.30 per 1M input tokens — a 10-minute recording is roughly 150K tokens, so a few cents per recording.

---

## Example workflow

Drop in a research paper. Claude Code reads it and writes an HTML note; StashBase indexes the note locally. Weeks later, in Claude or ChatGPT: *"that paper on test-time compute scaling"* — retrieved instantly.

More workflows — course archives, research landscapes, podcast notes, competitor teardowns — on [stashbase.ai](https://stashbase.ai/#gallery).

Codebase retrieval is already well served by [Claude Context](https://github.com/zilliztech/claude-context). StashBase focuses on everything else that accumulates around AI work.

---

## Capture

Stashing means saving the content itself — not a link to it — into your knowledge base. Every format gets a real treatment:

| Format | Viewing | Into the index |
|---|---|---|
| Markdown | Rendered preview / source edit / live split | Indexed directly |
| HTML | Full render — scripts and self-contained apps run | Indexed directly, split by headings |
| PDF | Built-in reader; hits locate the passage on the page | Background extraction to a hidden Markdown companion (figures included) |
| Images | Inline preview + lightbox | Local OCR text layer (RapidOCR, on-device) |
| Video & screen recordings | The product *is* a note | Multimodal understanding (Gemini, key required) → summary + structured content |

Structured formats are indexed as they are; unstructured formats are extracted into searchable text first.

Failed conversions surface a **Retry** button and are never auto-retried — failures are usually persistent (scanned-only, encrypted, …), so retrying is always your call.

### Space-level import & portable embeddings

**Import folder** brings any local directory in as a new space. If the folder carries a `.stashbase/snapshot.parquet`, its embedding cache is reused on open — unchanged content never re-embeds. That's how the CS183B starter opens fully indexed without costing you a token.

---

## Retrieval

A StashBase KB is a folder on disk (default `~/Documents/StashBase`) containing **spaces** — first-level subdirectories. Inside spaces: HTML, Markdown, PDF, images, plus hidden extraction companions and asset bundles.

Indexing runs locally via [mfs](https://github.com/zilliztech/mfs) + [Milvus Lite](https://milvus.io/docs/milvus_lite.md). The index is **KB-level** (one collection per KB), so retrieval works across spaces or scoped to one.

### When is content indexed?

* App-internal writes (editor save, drag-and-drop) → indexed immediately; MCP `write_file` indexes in the background
* External writes (other editors, git, scripts) → reconciled at deterministic moments: when you return to the window, when an agent finishes a turn, when you open the space, or on manual Sync
* Other spaces → reconciled when you next open them. No library-wide background scanning — embedding spend stays predictable and visible
* Agents writing via shell can call MCP `update_index` to sync any space explicitly

Renames, moves, and unchanged-content rewrites are detected by content hash and **never re-embed** — vectors are the only expensive thing here, and they're never computed twice for the same bytes.

### Embedder

OpenAI `text-embedding-3-small` — the single, fixed embedder in V1 (no provider switching). The whole library lives in one Milvus collection. Without an API key, only embedding and semantic search are disabled — files still save and preview, and keyword search (ripgrep, no index involved) keeps working.

### Search

Hybrid retrieval: dense vector kNN + BM25, fused server-side via RRF in a single Milvus query. Hits on PDFs and images map back to the original file — hidden extraction notes never surface. Available through:

* GUI search bar (semantic by default; toggle to exact keyword via ripgrep)
* MCP `search_kb` tool for any AI client
* The built-in chat panel (over MCP)

```text
        Built-in chat panel
       (Claude Code / Codex)
                │
                ▼
        ┌─────────────────────┐
        │      StashBase      │
        │  Hybrid retrieval   │
        │  (mfs + Milvus Lite)│
        └─────────┬───────────┘
                  │
              MCP (stdio)
                  │
                  ▼
    Claude Desktop · ChatGPT · Gemini
            any MCP client
```

### MCP exposure with one-click connector

**Settings → MCP** writes the StashBase MCP server entry directly into your AI client's global config (Claude Code, Claude Desktop, Codex CLI, Gemini CLI, Qwen Code) or copies the right stdio snippet for GUI-managed clients. One-time setup; afterwards the KB stays reachable from those clients **even when the StashBase app is closed**.

The tool surface covers both halves of a memory layer — using it and tending it:

* **Read:** `search_kb`, `get_file`, `list_files`, `recent_files`
* **Write:** `write_file`, `rename_file`, `delete_file`, `set_file_metadata` — writes index in the background; `index_status` tells you when search has caught up
* **Orient & maintain:** `kb_info`, `space_info`, `get_rules`, `update_space_metadata`, `update_index`, `index_status`

---

## Agents

### Built-in chat panel (Claude Code / Codex)

A structured chat panel runs Claude Code and Codex inside StashBase — message bubbles, streaming thinking, expandable tool calls, and an inline diff viewer with approve/reject. The design tracks the VS Code Claude extension closely.

* Runs the CLI already on your machine — your login, your subscription, your global config. No parallel universe.
* `cwd` automatically set to the current space, with that space's rules, skills, and MCP servers in view
* Reads pass silently; file edits and commands round-trip to you for approval
* Permission modes (default / accept-edits / plan / auto) and thinking-effort switchable in-panel
* Sessions stored in the CLI's standard location (`~/.claude/`) — start a conversation in the panel, resume it in your terminal, or the other way around
* Multiple tabs = multiple parallel sessions; files dragged into the panel become temporary context, never KB imports

### Agent-maintained KB via `STASHBASE.md`

Drop a `STASHBASE.md` into the KB root (or per-space) to define maintenance rules in plain language — what to summarize, how to file things, when to dedupe. Agents fetch the merged rules over MCP (`get_rules`) before they touch anything, and tidy as they go while doing your work. **No background daemon, no scheduled jobs, no tokens quietly burned.**

---

## Build from source

For contributors and developers building locally, and for platforms without a prebuilt cask (Intel Mac, Windows, Linux). End users on Apple Silicon should just use the brew cask above.

```bash
# Setup
git clone https://github.com/liliu-z/stashbase
cd stashbase
pnpm install
pnpm setup:python

# Run the Electron app
pnpm build:web
pnpm electron

# Development mode (hot reload) — run `pnpm electron` in a second
# terminal and it reuses the dev server
pnpm dev

# Build distributable app
pnpm dist:mac
pnpm dist:win
```

**Debugging.** Dev knobs are plain environment variables — prefix the command, e.g. `STASHBASE_LOG=debug pnpm dev` (daemon ops, conversion timing; also: `STASHBASE_PDF_CONVERTER=marker`, `STASHBASE_PYTHON=/path/to/python`). API keys are NOT env vars — they live in Settings. Renderer logs: View → Toggle Developer Tools. Packaged-app server logs: `~/Library/Logs/StashBase/`; headless-server boots log to `~/.stashbase/headless-server.log`.

Before opening a PR:

```bash
pnpm exec tsc --noEmit
pnpm test:import-folder
```

## Publishing

`dist:brew` is the one-command publishing flow: build the macOS package, upload the current version's files in `release/` to this repository's GitHub Release, then publish the Homebrew cask update.

```bash
pnpm dist:brew
```

The cask defaults to `liliu-z/stashbase/stashbase`, backed by `git@github.com:liliu-z/homebrew-stashbase.git`; override it with `HOMEBREW_TAP`, `HOMEBREW_TAP_GIT_URL`, or `HOMEBREW_CASK` if needed. GitHub Release asset upload uses `gh` when `GITHUB_TOKEN` is not set, so run `brew install gh && gh auth login` once on a new machine. Homebrew cask publishing commits and pushes directly to the SSH tap repository.

---

## MCP integration

**Settings → MCP** is the normal path (see [Retrieval](#mcp-exposure-with-one-click-connector)). The manual config below is for source builds, or for inspecting the exact settings.

The MCP server is a stdio command:

* Homebrew / packaged app: `~/.stashbase/bin/stashbase-mcp` (generated the first time you connect a client from **Settings → MCP**)
* Source checkout: `npx tsx /absolute/path/to/StashBase/mcp/server.ts`

Point any MCP-aware client at it. Examples use the packaged path — for source builds, substitute the `npx tsx` command. Restart the client after changing MCP servers.

### Claude Code

```bash
claude mcp add stashbase -- ~/.stashbase/bin/stashbase-mcp
```

### Claude Desktop

In `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "stashbase": {
      "command": "/Users/YOUR_USER/.stashbase/bin/stashbase-mcp"
    }
  }
}
```

Other JSON-configured clients take the same shape in their own MCP settings.

### Codex CLI

In `~/.codex/config.toml`:

```toml
[mcp_servers.stashbase]
command = "/Users/YOUR_USER/.stashbase/bin/stashbase-mcp"
```

---

## Status

Early alpha. macOS arm64 (Apple Silicon) is the supported platform today; Windows / Linux are post-V1. Screen recording uses the native system picker on macOS 15+; on older versions you can record individual windows, but not full-screen apps.

### Reasonably stable

* KB / space file model on disk (HTML / Markdown / PDF / images + hidden companions and asset bundles)
* Hybrid retrieval (semantic + keyword), with PDF/image hits mapping back to originals
* MCP KB server (stdio) with the full read/write/maintenance tool surface; one-click client connectors
* Event-point reconcile (space open, window focus, agent turn end, manual sync); rename/move without re-embedding
* Conversion pipeline: PDF extraction, image OCR (local), with persisted failures + Retry
* Screen recording → structured note with the original video attached (Gemini video understanding; key required, checked before capture starts)
* Structured Claude chat panel: tool calls, inline diff approve/reject, permission modes, history & resume
* Multi-window, per-space MCP server injection, KB root migration, space snapshot import

### Evolving in V1

* **Codex chat panel** — the panel shell is in place; the structured Codex session is landing now
* **Recording pipeline polish** — extraction quality, noise filtering, long recordings
* **`STASHBASE.md` schema** — V1 stays freeform natural language; a precise, checkable schema is a separate RFC
* **Retrieval filters** — file type / time range, pushed down into the index query

### Post-V1

Windows / Linux, note-first treatment for dropped-in videos, cloud sync, multi-device, mobile access, team collaboration.

Pin a commit if you're embedding StashBase into a larger workflow.

---

## Contributing

Small focused PRs are preferred. Open an issue before larger changes so scope and direction can be discussed first. Setup, debugging, and release live in [Build from source](#build-from-source) and [Publishing](#publishing) above.

---

## About

Built by Li Liu.

I work on [Milvus](https://github.com/milvus-io/milvus) at [Zilliz](https://zilliz.com), where I've spent the last few years building vector retrieval infrastructure for AI systems.

Coding with agents already feels fluid inside IDEs. Personal knowledge tools still largely don't.

StashBase is my attempt at the missing layer: an agent-native, local-first workspace where papers, notes, transcripts, and saved analysis remain continuously retrievable across AI workflows.

This is a personal side project built in the open. PRs, issues, and experiments are welcome.
