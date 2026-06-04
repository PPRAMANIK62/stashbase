/**
 * All SVG icons used in the UI. Sized via parent CSS so each component
 * stays a pure shape — no width/height props. Stroke colour follows
 * `currentColor` so the parent's `color` rule wins.
 */

type IconProps = { className?: string };

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function SearchIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" strokeWidth={2} {...stroke}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" strokeWidth={2} {...stroke}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function NewFileIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" strokeWidth={1.6} {...stroke}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  );
}

export function NewFolderIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" strokeWidth={1.6} {...stroke}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  );
}

export function FolderIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" strokeWidth={1.6} {...stroke}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function SyncIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" strokeWidth={1.6} {...stroke}>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <polyline points="21 3 21 8 16 8" />
    </svg>
  );
}

/** Chevrons point INWARD (top points down, bottom points up — meeting
 *  in the middle). Reads as "compress / fold". Sidebar shows this
 *  when some folders are still open; clicking collapses them. */
export function CollapseAllIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" strokeWidth={1.6} {...stroke}>
      <polyline points="8 4 12 9 16 4" />
      <polyline points="8 20 12 15 16 20" />
    </svg>
  );
}

/** Chevrons point OUTWARD (top points up, bottom points down — pulling
 *  apart). Reads as "spread / expand". Sidebar swaps to this when
 *  everything is already folded; clicking expands all. */
export function ExpandAllIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" strokeWidth={1.6} {...stroke}>
      <polyline points="8 9 12 4 16 9" />
      <polyline points="8 15 12 20 16 15" />
    </svg>
  );
}

export function FileGenericIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" strokeWidth={1.5} {...stroke}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

/** Stacked-pages icon for the "Files" activity-bar view — two
 *  overlapping document silhouettes, à la VS Code's Explorer icon.
 *  Two independent paths (back-doc visible outline + front-doc full
 *  outline) so the folded corners read cleanly; the back doc only
 *  draws the edges that aren't occluded by the front. */
export function FilesViewIcon({ className }: IconProps) {
  // Lucide `file-text` — same document frame as `NewFileIcon` so the
  // two read as a family; three text rows say "file listing".
  return (
    <svg className={className} viewBox="0 0 24 24" strokeWidth={1.6} {...stroke}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
      <line x1="8" y1="9" x2="10" y2="9" />
    </svg>
  );
}

export function EditIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" strokeWidth={1.8} {...stroke}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export function PreviewIcon({ className }: IconProps) {
  // Open-book silhouette for the floating edit/read toggle. Earlier it
  // was drawn with two geometric half-pages that read as "two
  // trapezoids", not a book; this shape is unambiguous.
  return (
    <svg className={className} viewBox="0 0 24 24" strokeWidth={1.7} {...stroke}>
      <path d="M3 5 C7 4 9 4 12 6 C15 4 17 4 21 5 V19 C17 18 15 18 12 20 C9 18 7 18 3 19 Z" />
      <path d="M12 6 V20" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" strokeWidth={2.2} {...stroke}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/** Robot head — the file glyph for STASHBASE.md (the rules book the
 *  agent maintains). antenna + rounded head + two eyes + mouth line. */
export function BotIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" strokeWidth={1.6} {...stroke}>
      <line x1="12" y1="2" x2="12" y2="5" />
      <circle cx="12" cy="2" r="0.8" fill="currentColor" stroke="none" />
      <rect x="4" y="5" width="16" height="14" rx="3" />
      <circle cx="9" cy="11" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="11" r="1.2" fill="currentColor" stroke="none" />
      <line x1="9" y1="15.5" x2="15" y2="15.5" />
    </svg>
  );
}

/** Table-of-contents / 目录 glyph for space-metadata.md (the
 *  agent-maintained catalog of spaces): bullets + lines. */
export function CatalogIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" strokeWidth={1.7} {...stroke}>
      <circle cx="5" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="18" r="1" fill="currentColor" stroke="none" />
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="20" y2="18" />
    </svg>
  );
}

/** Two overlapping sheets — the conventional "copy to clipboard" glyph
 *  (Lucide proportions: front sheet + back sheet peeking top-left). */
export function CopyIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" strokeWidth={2} {...stroke}>
      <rect x="8" y="8" width="14" height="14" rx="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

/** Chat bubble — toggle for the right-side AI assistant panel. The
 *  panel runs whatever CLI the user picked (Claude / Codex / …), so
 *  the icon stays brand-neutral. `currentColor` lets it pick up the
 *  chip's state color (muted at rest, accent when active). */
export function ChatIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" strokeWidth={1.6} {...stroke}>
      <path d="M4 5 H20 A2 2 0 0 1 22 7 V15 A2 2 0 0 1 20 17 H12 L7 21 V17 H4 A2 2 0 0 1 2 15 V7 A2 2 0 0 1 4 5 Z" />
    </svg>
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" strokeWidth={1.6} {...stroke}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  );
}

export function ArrowLeftIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" strokeWidth={1.8} {...stroke}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" strokeWidth={1.8} {...stroke}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export function SidebarLeftIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" strokeWidth={1.5} {...stroke}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
    </svg>
  );
}

export function CubeLogoIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g stroke="#6b7280" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round">
        <path d="M92 158 L92 342" />
        <path d="M92 342 L256 436" />
      </g>
      <g stroke="#0891b2" strokeWidth={20} strokeLinecap="round" strokeLinejoin="round">
        <path d="M92 158 L256 64 L338 111" />
        <path d="M92 158 L256 252 L420 158" />
        <path d="M420 158 L420 342" />
        <path d="M256 436 L420 342" />
        <path d="M256 342 L256 436" />
      </g>
    </svg>
  );
}

/** House — chrome-strip button that returns to the Welcome screen
 *  (`actions.goHome()`). The clean way to switch spaces without
 *  losing tab/nav state to a full page reload. */
export function HomeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" strokeWidth={2} {...stroke}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}
