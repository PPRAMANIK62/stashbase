# Roadmap and Contribution Areas

This document describes the larger product and technical directions StashBase is likely to evolve toward. It is not a committed release plan. Its job is to help contributors understand where useful work can fit, what each area is trying to become, and which boundaries should stay intact.

For current architecture, see [architecture](architecture.md). For the current Markdown preview design, see [markdown-rendering](markdown-rendering.md). For the built-in agent panel, see [agent-panel](agent-panel.md).

## Priority Guide

- **P0**: near-term work that directly improves the main user path.
- **P1**: important next-layer polish or capability after the main path is stable.
- **P2**: useful but should wait until the core interaction model is clearer.

## 1. Search and Vector Index Control

**Priority:** P0

**Goal:** make search feel controllable, explainable, and useful across mixed local folders.

StashBase already builds semantic and keyword indexes over opened local folders. The next step is giving users and agents better control over that index at query time.

Near-term contribution options:

- Add subfolder scoping in the Search panel.
- Add file-type filters for Markdown/HTML, PDF, DOCX, and images.
- Keep derived notes hidden while remapping PDF/image hits back to their original source files.
- Add clearer empty, partial, indexing, and failure states.

Later options:

- Ranking controls such as top-k, score visibility, grouping, and sort modes.
- Saved search scopes.
- Better index diagnostics and repair affordances.

Why this matters:

Search is the bridge between a folder full of files and agent-ready context. If users cannot narrow or understand results, the vector index feels magical in the bad way.

Design boundaries:

- Search must preserve the local folder ownership model.
- App search and MCP search should converge where possible, rather than growing separate semantics.
- Derived files are implementation details and should not become normal user-facing search results.

References:

- Obsidian: simple local search with optional narrowing.
- VS Code: explicit include/exclude controls.
- StashBase MCP `search_library`: already supports folder and path-prefix scoping.

## 2. Markdown Editing Experience

**Priority:** P0

**Goal:** make editing feel like writing in a knowledge base, not programming in a code editor.

The current Markdown editor is CodeMirror-based and intentionally reliable, but it still looks and feels close to a code editor: line numbers, gutters, monospace typography, active-line styling, and code-like spacing. Long term, editing should visually sit closer to preview.

Near-term contribution options:

- Hide line numbers and fold gutters in Markdown edit mode.
- Move editor typography closer to the preview surface.
- Reduce code-editor visual cues such as active-line emphasis.
- Keep keyboard behavior reliable for writing, links, find, undo/redo, and save.

Later options:

- Live-preview style Markdown editing.
- WYSIWYG-like handling for headings, lists, links, and images.
- Better image and attachment insertion flows.
- Per-user editor preferences if the simple default is not enough.

Why this matters:

Many StashBase users think in notes, not code. If edit mode feels like VS Code, it creates friction for Obsidian-like workflows.

Design boundaries:

- Markdown source remains the file source of truth.
- Editing must stay local and fast.
- Preview and edit mode should become visually consistent without making the editor fragile.

References:

- Obsidian: editing and reading modes feel related.
- Notion: writing surface is quiet and document-native.
- VS Code: useful keyboard reliability, but too code-like as the default note editor.

## 3. Markdown Preview Completeness

**Priority:** P1

**Goal:** make read-only Markdown preview handle common technical and knowledge-base documents without weakening iframe isolation.

Recent work moved preview toward package-native Markdown extensions for footnotes, heading anchors, frontmatter, and GitHub alerts. Remaining work should keep following that pattern: document preview can become richer, while agent-message Markdown stays separate.

Near-term contribution options:

- Syntax-highlight fenced code with scriptless render-time highlighting.
- Improve narrow-window behavior for tables, long URLs, inline code, and task lists.
- Add offline KaTeX math with local bundled assets.

Later options:

- Mermaid or diagrams, if they can be rendered without weakening the trust boundary.
- Wikilinks or embeds, if they map cleanly onto local files.
- Better preview themes only after the base document style is stable.

Why this matters:

Preview is the reading surface. It should be good enough for real notes, papers, specs, and technical docs, without asking users to leave StashBase.

Design boundaries:

- No iframe scripts for ordinary Markdown preview.
- No CDN or runtime network requirement for rendering.
- Document preview changes must not alter Agent-message Markdown.
- Sanitizer coverage and regression fixtures matter for every new extension.

References:

- GitHub Markdown: alerts, anchors, code blocks, task lists.
- Obsidian: math, readable notes, internal navigation.

## 4. Agent Panel Polish

**Priority:** P1

**Goal:** make the built-in Claude/Codex panel feel like a native developer-tool side panel while staying grounded in the current folder.

The current panel supports Claude and Codex tabs and can work with StashBase file context. The next layer is interaction polish: clearer transcript states, better file references, better tool activity, and smoother context handoff.

Near-term contribution options:

- Improve file mentions and at-mention suggestions.
- Make tool activity easier to scan without hiding important states.
- Improve diff and file-change presentation.
- Tighten chat tab lifecycle, history, and recovery behavior.

Later options:

- Selected-text or current-section context handoff.
- Better per-agent settings and status.
- More explicit MCP/context diagnostics inside the panel.

Why this matters:

StashBase is not only a viewer; it is a local context surface for agents. The panel is where users see whether that promise is working.

Design boundaries:

- The panel should feel close to VS Code's Claude Code and Codex plugin model, not like a generic web chatbot.
- Agent actions should remain tied to opened local folders and bounded file tools.
- Transcript compaction must not hide actionable or terminal states.

References:

- VS Code side panels for Claude Code and Codex.
- Cursor-style chat tabs and file diffs.

## 5. Conversion, Recovery, and Diagnostics

**Priority:** P1

**Goal:** make long-running file preparation boring, recoverable, and debuggable.

StashBase converts and indexes PDFs, DOCX files, and images in the background. That path is inherently failure-prone across platforms and file types, so recovery and diagnostics matter as much as happy-path conversion.

Near-term contribution options:

- Improve user-facing retry and failure states.
- Make logs and diagnostic locations easier to find on macOS, Windows, and Linux.
- Add exportable diagnostic bundles that avoid user document contents.
- Continue hardening deleted-file, moved-file, and interrupted-conversion cleanup.

Later options:

- More granular conversion progress.
- Better OCR/PDF fallback choices.
- Background job inspection for advanced users.

Why this matters:

Users trust local-first tools when failures are understandable. If preparation silently fails, search and agent context become unreliable.

Design boundaries:

- Background preparation should stay quiet during normal browsing.
- Diagnostics should be opt-in and privacy-preserving.
- Original user files must never be modified by conversion or index repair.

References:

- Desktop app crash logs and diagnostic bundles.
- Obsidian-style local file ownership.

## 6. Cross-Platform Packaging

**Priority:** P1

**Goal:** make install, launch, update, and debug behavior consistent across macOS, Windows, and Linux.

StashBase already ships desktop builds, but packaging remains an evolving area because the app combines Electron, Node, Python sidecars, local vector storage, and platform-specific filesystem behavior.

Near-term contribution options:

- Verify release builds on Windows and Linux, not only macOS.
- Improve release notes with platform-specific known issues.
- Keep packaged server logs discoverable.
- Tighten bundled sidecar and resource checks.

Later options:

- Auto-update strategy.
- Code signing and notarization.
- Better first-run diagnostics.

Why this matters:

Exposure creates first-time users. If installation or first launch fails, most users will not file a detailed bug report.

Design boundaries:

- Packaging fixes should not change the local-first data model.
- Platform-specific paths must be explicit and documented.
- Sidecar failures should surface with useful logs.

## 7. Contribution Fit

Good first contribution areas:

- Markdown preview fixtures and small renderer extensions.
- Search panel filters and UI polish.
- Documentation updates that clarify platform behavior.
- Small Agent panel display fixes.

Medium-sized contribution areas:

- Markdown edit-mode visual redesign.
- Search ranking controls.
- Diagnostic bundle export.
- Agent panel mention and transcript improvements.

Large contribution areas:

- Live-preview Markdown editing.
- Mermaid/diagram rendering.
- Auto-update and signed packaging.
- Major index/retrieval ranking changes.

Before opening a large PR, prefer opening or commenting on an issue with:

- the user-facing problem,
- the intended behavior,
- any library or package you plan to add,
- security or privacy boundaries,
- test coverage you expect to add.
