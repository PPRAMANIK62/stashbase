# Built-In Agent Panel Design

> Code review contract: this document preserves built-in Agent Panel implementation and review constraints for maintainers and AI reviewers. For contributor-facing panel direction, see [design-docs/design/agent-panel.md](../design-docs/design/agent-panel.md).

This document captures the product design contract for the built-in Claude/Codex panel. The architecture remains in [architecture.md](architecture.md); this file is only about renderer behavior and visual direction.

## Direction

The built-in Agent panel should feel like a VS Code-style agent side panel for local files, not a separate AI workspace.

The panel may make agent work easier to scan, but it should stay quiet:

- low chrome
- compact controls
- restrained borders and cards
- no decorative motion or visual metaphor
- no new workspace model separate from the user's local folder

## Renderer foundation

The renderer retains its existing CSS during the Tailwind v4 migration. Shared
semantic theme roles (surface, text, border, focus, status, density, radius,
elevation, and motion) are exposed as CSS variables and Tailwind tokens; new
work consumes those roles rather than inventing visual literals. New accessible
popup/control work uses Base UI. React Aria Components remain only where they
already own a transitional surface and are not a dependency choice for new
renderer work. Motion is limited to structural/status feedback and runs under
the user reduced-motion policy: transforms and layout animation stop while
opacity feedback remains available. Foundation primitives that are only needed
after an interaction may load at that interaction boundary, preserving the
enforced initial-renderer budget without making the feature unavailable.

Community contributions can land as useful first iterations, but the long-term design should continue to be simplified toward this side-panel model when needed.

## Design Rules

- Keep the panel renderer-led. Do not change agent transport, session persistence, MCP, indexing, or permission policy just to support presentation changes.
- Prefer small, familiar agent-chat affordances over a bespoke workbench UI.
- Treat user-action states as first-class. Permission approvals, retry actions, and stopped-turn editing must remain visible and directly actionable.
- A discovered missing Agent CLI is a setup state, not a disabled launcher or a
  generic connection failure. Keep its install command copyable and let the
  user re-run discovery after installation; do not conflate it with an
  installed runtime that has failed.
- Keep background activity compact. Tool calls may be grouped or summarized, but the user must be able to inspect them when needed.
- File outputs should be easy to open, but artifact UI should stay lightweight. Prefer rows or compact affordances over large delivery cards.
- Streaming should not steal the user's scroll position. If the user has scrolled away from the bottom, show a clear jump-to-latest affordance.
- The current document is never implicit agent context. Users attach files by drag/drop, file picker, `@` mention, or a composer-focused image paste. Image paste must reuse transient attachments, preserve accompanying text, and suppress the competing clipboard library-import offer.
- The top-bar Claude and Codex icons select or toggle existing chats. Creating a new chat belongs to the in-panel `+`.

## Current Baseline

The accepted baseline includes:

- per-agent chat tab selection and toggle behavior
- keyboard navigation for `@` file and folder mentions. Ranking normalizes
  Unicode accents and ignores case, punctuation, whitespace, and path
  separators; basename matches precede path-only matches, ties use a
  locale-independent order, and raw workspace-relative paths remain the
  stable item IDs and inserted tokens.
- smooth chat-side resize without drag-frequency global state updates
- compact activity grouping for non-actionable tool calls, with inspectable
  command/read/search labels rather than lifecycle-only summaries
- visible permission cards outside collapsed activity
- lightweight file/artifact open affordances
- jump-to-latest behavior for transcript scrolling
- GFM Agent-message rendering through React elements, never an HTML string or
  raw HTML parser. Keep remote images and non-HTTP(S), non-workspace links
  inert; local links continue through the folder-safe workspace callback.
- React Aria controls for popover dismissal, focus management, and menu/listbox
  semantics, including permission decisions and destructive history
  confirmation. CodeMirror remains the owner of composer text, selection,
  undo, and mention-key handoff; keep its presentation chat-like and its
  height capped so the transcript retains reading space. Image attachments
  show renderer-local thumbnails, never their transient filesystem paths;
  sent thumbnails remain available for the current transcript, while their URLs
  are revoked when removed, the transcript is replaced, or the panel unmounts.
  Restored Claude and Codex sessions may recreate thumbnails only for live
  transient image files through the scoped local preview route; never expose
  an arbitrary path found in a transcript. The route resolves the real target
  under a non-symlinked private attachment root before it reads it. When a
  permission action removes its own controls, restore focus to the persistent
  tool-card trigger.
- Image-preview controls float over the image: Download and Close at the top
  right, and a bottom-centred zoom group. They need accessible names and hover
  titles; do not replace their semantic buttons with non-interactive artwork.
  Use clean, optically centred `+` and `−` line glyphs for zoom rather than
  ornate magnifying-glass icons; keep the floating control surfaces borderless.

These are still implementation details, not a new product category. If the panel starts to feel heavier than VS Code/Codex/Claude Code side chat, the preferred follow-up is to reduce visual weight rather than add more structure.
