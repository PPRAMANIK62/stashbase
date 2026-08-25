/**
 * The transcript's tool surface: the collapsed activity group, the rows
 * inside it, the artifact cards a group leaves behind, the inline diff, and
 * the one tool card that stays actionable — a permission ask. Classification
 * is pure and lives in `lib/toolActivity`, `lib/toolPayload`, and
 * `lib/diffModel`; this module only renders it.
 */
import { useMemo, useRef, useState } from 'react';
import { Button } from '@/common/components/ui/button';
import { ChevronDownIcon, CodeIcon, EditIcon, FileGenericIcon, FolderIcon, NewFileIcon, SearchIcon } from '@/common/components/icons';
import { cn } from '@/common/lib/utils';
import { buildDiff, type DiffRow } from '@/features/agent-panel/lib/diffModel';
import { accentDotClass } from '@/features/agent-panel/lib/panelStyles';
import { activitySummary, askTitle, classifyTool, fileChanges, toolRowParts } from '@/features/agent-panel/lib/toolActivity';
import { clipResult, payloadPreview } from '@/features/agent-panel/lib/toolPayload';
import type { ToolBlock } from '@/features/agent-panel/lib/types';
import { Card } from '@/common/components/ui/card';
import { SectionHeading } from '@/common/components/ui/section';

/** Mono detail blocks inside tool cards (input JSON, results, commands).
 *  A class string, not a component: its three call sites are three
 *  different `<pre>` bodies in this file — a truncated payload, a clipped
 *  result, a raw command — and the only thing they share is the block's
 *  shape. A `<ToolPre>` would forward children and nothing else. */
const toolPreClass =
  'mt-1.5 mb-0 max-h-70 overflow-x-auto overflow-y-auto rounded-md border border-border bg-pane px-2.5 py-2 font-mono text-xs leading-normal break-words whitespace-pre-wrap';

export function ToolActivityGroup({ tools, live = false, onOpenArtifact }: {
  tools: ToolBlock[];
  /** This group is the live tail of an active turn. Keep the liveness cue
   *  (dot + shimmer + "…") lit across the whole tool stretch, not only while
   *  one tool happens to be `running`: between consecutive calls the group
   *  would otherwise go dark and the generic "…is working" tail would jump
   *  onto its own line. */
  live?: boolean;
  onOpenArtifact: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = live || tools.some((tool) => tool.status === 'running');
  const summary = activitySummary(tools, active);
  return (
    // Activity is narration, not a construct: a quiet text-level
    // disclosure in the reading column (Cursor's "Explored 1 search"
    // register) — no full-width band, no left edge. It stays neutral even
    // when a step errored: intermediate tool failures are normal and the
    // agent usually recovers, so the collapsed line never shouts red. A
    // failed step still tints its own row inside the expansion, and a turn
    // that truly fails is explained by the inline fatal notice — not here.
    // Permission cards never enter these groups, so nothing actionable can
    // hide behind the collapse.
    <section className="agent-activity">
      <Button
        variant="ghost"
        className="group/row w-full justify-start gap-1.5 px-1.5 py-1 text-left text-sm"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {/* One leading glyph, Codex-style: the pulsing liveness dot while the
          * group is the live tail, the first step's type icon once settled.
          * The disclosure chevron moves to the trailing edge and only fades
          * in on hover (or while open), so a resting row is just icon + text. */}
        {active ? <span className={accentDotClass} aria-hidden="true" /> : <ToolTypeIcon name={tools[0].name} input={tools[0].input} />}
        <span className={cn('min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground', active && 'working-shimmer')}>{summary}</span>
        <ChevronDownIcon className={cn('ml-auto size-3 shrink-0 text-muted-foreground transition-opacity duration-fast ease-out', open ? 'opacity-60' : 'opacity-0 group-hover/row:opacity-60', !open && '-rotate-90')} />
      </Button>
      {/* The expanded steps are a list, not a run of rows: a screen reader
        * announces "5 items" and each step's boundary instead of one
        * undifferentiated paragraph of narration. */}
      {open && <ul className="m-0 grid list-none gap-0.5 pb-0.5 pl-5">{tools.map((tool) => <ToolRow key={tool.id} block={tool} />)}</ul>}
      <ArtifactCards changes={tools.filter((tool) => tool.status === 'done').flatMap(fileChanges)} onOpen={onOpenArtifact} />
    </section>
  );
}

/** The leading type glyph on an activity row — Read, Ran, Searched,
 * Wrote, Edited, Listed — so a row's kind reads before its text (Codex
 * register). Muted, or danger on a failed step. */
function ToolTypeIcon({ name, input, failed }: { name: string; input: Record<string, unknown>; failed?: boolean }) {
  const cls = cn('size-3.5 shrink-0', failed ? 'text-status-danger' : 'text-muted-foreground');
  switch (classifyTool(name, input)) {
    case 'read': return <FileGenericIcon className={cls} />;
    case 'list': return <FolderIcon className={cls} />;
    case 'search': return <SearchIcon className={cls} />;
    case 'command': return <CodeIcon className={cls} />;
    case 'write': return <NewFileIcon className={cls} />;
    case 'edit': case 'file-change': return <EditIcon className={cls} />;
    default: return <FileGenericIcon className={cls} />;
  }
}

/** The payload a tool surface renders once, shared by ToolRow and
 * PermissionCard so the fallback ladder cannot drift: a structured diff
 * when the input is a file change, the raw command for Bash, the payload
 * preview otherwise. */
function ToolPayloadBody({ block }: { block: ToolBlock }) {
  const diff = useMemo(() => buildDiff(block.name, block.input), [block.name, block.input]);
  if (diff) return <DiffView diff={diff} />;
  if (block.name === 'Bash') return <pre className={toolPreClass}>{String(block.input.command ?? '')}</pre>;
  return <pre className={toolPreClass}>{payloadPreview(block.input)}</pre>;
}

/** One tool inside an expanded activity group, Codex-style: a flat text
 * row — a small type icon, the action verb, and its object (a file name
 * underlined like a link, or a command / query in mono). No card, no
 * status badge; a finished step needs no "Done". The row toggles its
 * payload / result in place and reveals a chevron on hover. Failures tint
 * the whole row danger. Permission asks never appear here — they render
 * as their own card. */
function ToolRow({ block }: { block: ToolBlock }) {
  const [open, setOpen] = useState(false);
  const { verb, target, mono } = toolRowParts(block.name, block.input);
  const running = block.status === 'running';
  const failed = block.status === 'error' || block.status === 'denied';
  return (
    <li className="group/row">
      <Button
        variant="ghost"
        className={cn(
          'w-full justify-start gap-1.5 px-1.5 py-1 text-left text-sm',
          failed ? 'text-status-danger' : 'text-muted-foreground',
        )}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <ToolTypeIcon name={block.name} input={block.input} failed={failed} />
        <span className={cn('shrink-0', running && 'working-shimmer')}>{verb}</span>
        {target && (
          <span className={cn(
            'min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap',
            mono ? 'font-mono text-xs' : 'underline decoration-1 underline-offset-2',
          )}>{target}</span>
        )}
        <ChevronDownIcon className={cn('ml-auto size-3 shrink-0 transition-opacity duration-fast ease-out', open ? 'opacity-60' : 'opacity-0 group-hover/row:opacity-60', !open && '-rotate-90')} />
      </Button>
      {open && (
        <div className="pb-1 pl-6">
          <ToolPayloadBody block={block} />
          {block.result != null && block.result !== '' && (
            <pre className={cn(toolPreClass, 'agent-tool-result', block.status === 'error' && 'err')}>{clipResult(block.result)}</pre>
          )}
        </div>
      )}
    </li>
  );
}

/** The one tool surface that stays a card: an approval ask. It is
 * actionable, so it must never hide inside collapsed activity. Quietest
 * chrome — the ask is the title, the payload renders once, and the single
 * primary button is the only emphasis. Approval stays an explicit click. */
export function PermissionCard({ block, onPermission }: { block: ToolBlock; onPermission: (t: string, p: string, a: boolean) => void }) {
  const headRef = useRef<HTMLHeadingElement>(null);
  function replyPermission(allow: boolean) {
    onPermission(block.id, block.permId!, allow);
    // The buttons vanish once the Agent updates this block; keep keyboard
    // focus on the card instead of dropping it to <body>.
    requestAnimationFrame(() => headRef.current?.focus());
  }
  return (
    <Card className="overflow-hidden">
      <SectionHeading level={3} ref={headRef} tabIndex={-1} className="px-2.5 py-2 text-sm outline-none">
        {block.permTitle ?? askTitle(block.name)}
      </SectionHeading>
      {block.permId && (
        <div className="px-2.5 pb-2.5">
          <ToolPayloadBody block={block} />
          <div className="mt-2.5 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => replyPermission(false)}>Reject</Button>
            <Button size="sm" onClick={() => replyPermission(true)}>Allow</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function ArtifactCards({ changes, onOpen }: { changes: Array<{ path: string; kind: string }>; onOpen: (path: string) => void }) {
  if (!changes.length) return null;
  // One card per file — a path written repeatedly in one activity group
  // keeps its latest kind.
  const unique = [...new Map(changes.map((change) => [change.path, change])).values()];
  return <ul className="m-0 grid list-none gap-1 px-2.5 pb-2.5">{unique.map((change) => (
    <li
      className="grid grid-cols-[15px_minmax(0,1fr)_auto_auto] items-center gap-1.5 rounded-md border border-border bg-pane px-2 py-1.5 text-xs"
      key={change.path}
    >
      <FileGenericIcon className="size-3.5 text-accent" />
      <span className="overflow-hidden text-ellipsis whitespace-nowrap text-foreground" title={change.path}>{change.path}</span>
      <span className="capitalize text-muted-foreground">{change.kind}</span>
      <Button
        variant="link"
        size="xs"
        className="h-auto p-0 text-xs text-accent"
        onClick={() => onOpen(change.path)}
      >Open</Button>
    </li>
  ))}</ul>;
}

function DiffView({ diff }: { diff: { file: string; rows: DiffRow[] } }) {
  return (
    /* Frame, file strip and mono type are chrome and live here; only the
     * add/del row tints and their gutter glyph colours stay in
     * agent-panel.css, because those are the editor's One-Dark palette
     * rather than a theme role. `agent-diff-row` and `agent-diff-gutter`
     * survive as the hooks those two rules key on; the frame needed no
     * class of its own once its look moved here. */
    <div className="mt-1 overflow-hidden rounded-xl border border-border">
      <div className="border-b border-border bg-pane px-2 py-1 font-mono text-xs text-muted-foreground">{diff.file}</div>
      {/* 320px: enough for a readable hunk, capped so one large diff cannot
        * push the rest of the turn off the transcript. */}
      <div className="max-h-80 overflow-auto font-mono text-xs leading-normal">
        {diff.rows.map((r, i) => (
          <div key={i} className={cn('agent-diff-row flex whitespace-pre', r.type)}>
            {/* 16px holds the one +/- glyph the mono column needs. */}
            <span className="agent-diff-gutter w-4 shrink-0 text-center text-muted-foreground select-none">{r.type === 'add' ? '+' : r.type === 'del' ? '-' : ' '}</span>
            <span className="flex-1 pr-2">{r.text || ' '}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
