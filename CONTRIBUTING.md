# Contributing to StashBase

Thanks for your interest. StashBase is a small project — the goal is to
keep it small. Bug fixes, focused features, and doc improvements are all
welcome.

## Development setup

Prerequisites:
- Node.js >= 22.12
- [pnpm](https://pnpm.io/) (the repo ships `pnpm-lock.yaml`)
- Python 3.10+ (for the indexer sidecar)

```bash
pnpm install                # JS deps
pnpm setup:python           # creates python/.venv with mfs-cli + onnxruntime
pnpm dev                    # browser at http://localhost:8090
# or:
pnpm electron               # desktop app
```

The embedding model (`gpahal/bge-m3-onnx-int8`, ~200 MB) downloads once
into `~/.cache/huggingface/` on first daemon start.

## Codebase tour

```
StashBase/
├── server/        Express + Indexer abstraction + watcher + sync
├── python/        MFS sidecar daemon (ONNX embedder + Milvus Lite)
├── mcp/           stdio MCP server (HTTP-bridges to running daemon)
├── web-src/       single-page UI source (React + Vite)
├── web/           built web bundle (gitignored)
└── electron/      desktop shell + native folder picker
```

The load-bearing pieces in one screen:

- **Sidecar split** — the TypeScript server in `server/` spawns the
  Python daemon (`python/stashbase_daemon.py`) once at startup. They
  talk line-delimited JSON over stdio. ONNX / Milvus work happens in
  Python so Node's event loop never blocks.
- **Indexer abstraction** — `server/indexer.ts` is the contract every
  data op flows through; `server/indexer.mfs.ts` is the only impl
  today. Adding a different store (Qdrant, plain SQLite, …) means a
  new impl, no route changes.
- **Chunking + embedding** — handled by MFS. `mfs.chunker.MarkdownChunker`
  splits on ATX headers (re-splits long sections at ~1500 chars);
  `mfs.embedder.get_provider("onnx" | "openai")` does tokenisation +
  pooling. HTML notes get pre-flattened to markdown-shaped plaintext
  by `server/html.ts` so the markdown chunker still respects heading
  boundaries.
- **Hybrid search** — Milvus server-side BM25 (`Function` field) +
  dense vector kNN, fused via `RRFRanker(k=60)`. One round-trip, no
  client-side merge.
- **Per-space isolation** — each space gets its own
  `.stashbase/mfs/milvus.db` (Milvus Lite). Switching spaces rebinds
  the daemon's store; the DB file is portable and travels with the
  space directory.
- **Watcher** — `server/watcher.ts` runs `fs.watch` on the space root
  (800 ms debounce + self-write suppression). External edits (vim /
  git checkout / Dropbox / Claude Code via the in-app terminal) get
  picked up automatically, and the renderer re-reads the active tab
  so its preview reflects the change.

If you want more, the load-bearing modules each carry a doc comment
at the top — read those before diving into a route or thunk.

## Submitting changes

1. Fork the repo and create a topic branch off `main`.
2. Make your changes. Keep them focused — one logical change per PR.
3. Run typecheck + build locally before opening the PR:
   ```bash
   pnpm exec tsc --noEmit
   pnpm build
   ```
4. Open a PR against `main`. Describe **what** changed and **why** —
   the diff already shows the how.

## Code style

- **TypeScript**: strict mode. Avoid `any` unless you have a reason.
- **Comments**: explain the *why* (constraints, surprises, hidden
  invariants). Don't restate what the code already says.
- **No dead abstractions**: don't add helpers, options, or feature flags
  for hypothetical future requirements. Three similar lines beat a
  premature abstraction.
- **Match existing patterns**: read a couple of nearby files before
  introducing a new convention.

## Reporting bugs

Open a GitHub issue with:
- What you did, what you expected, what happened instead.
- StashBase version (`package.json` → `version`) and your OS.
- Relevant log output (Electron: View → Toggle Developer Tools →
  Console; daemon: `~/.stashbase/logs/`).

## License

By contributing, you agree that your contributions will be licensed
under the [Apache License 2.0](LICENSE).
