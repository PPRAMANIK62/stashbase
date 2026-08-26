import { useMemo } from 'react';
import { useAppActions, useWorkspace } from '@/store/contexts/AppContext';
import { computeLineDiff } from '@/store/lib/conflictDiff';
import { Button } from '@/common/components/ui/button';
import { SectionHeading } from '@/common/components/ui/section';
import { cn } from '@/common/lib/utils';

export function ConflictResolver({ tabId }: { tabId: string }) {
  const { tabs } = useWorkspace();
  const { actions } = useAppActions();
  const tab = tabs.find((t) => t.id === tabId);
  const conflict = tab?.conflict ?? null;
  // Hooks run before the bail-out: MainPane keeps this mounted across the
  // whole conflict, and a conditional hook would break on the render where
  // a resolution clears `conflict`.
  const diffRows = useMemo(
    // Left = Disk (Newer version), Right = Editor (Your unsaved changes)
    () => (conflict ? computeLineDiff(conflict.editorContent, conflict.diskContent) : []),
    [conflict],
  );
  if (!conflict || !tab?.file) return null;

  const fileName = tab.file.name;
  const resolving = conflict.resolving === true;

  return (
    <div
      className="flex h-full flex-col bg-background text-foreground"
      role="region"
      aria-labelledby={`conflict-title-${tabId}`}
      aria-busy={resolving}
    >
      {/* Banner bar */}
      <div className="flex items-center justify-between border-b border-muted bg-accent/5 px-4 py-3 shrink-0">
        <div className="min-w-0 flex-1">
          <SectionHeading level={3} id={`conflict-title-${tabId}`} className="truncate text-sm">
            Conflict detected in {fileName}
          </SectionHeading>
          <p className="text-xs text-muted-foreground mt-0.5">
            This file has been modified on disk by another program or agent. Choose how to resolve the conflict.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <Button
            variant="default"
            size="sm"
            disabled={resolving}
            onClick={() => void actions.resolveConflictReload(tabId)}
          >
            Reload from Disk
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={resolving}
            onClick={() => void actions.resolveConflictMerge(tabId)}
          >
            Merge and Edit
          </Button>
          <Button
            variant="destructive-outline"
            size="sm"
            disabled={resolving}
            onClick={() => void actions.resolveConflictOverwrite(tabId)}
          >
            Overwrite Disk
          </Button>
        </div>
      </div>

      {/* Comparison diff view */}
      <div className="flex-1 overflow-auto font-mono text-xs select-text">
        <table className="w-full border-collapse table-fixed min-w-[800px]">
          <caption className="sr-only">
            Line-by-line comparison of the newer file on disk and your unsaved editor changes
          </caption>
          <thead>
            <tr className="sticky top-0 bg-muted/20 border-b border-muted font-sans font-semibold text-muted-foreground text-2xs uppercase tracking-wider select-none">
              <th scope="col" className="w-12 border-r border-muted/30 py-1.5 bg-background"><span className="sr-only">Disk line number</span></th>
              <th scope="col" className="w-[calc(50%-24px)] text-left pl-3 py-1.5 bg-background">On Disk (Newer)</th>
              <th scope="col" className="w-12 border-l border-muted border-r border-muted/30 py-1.5 bg-background"><span className="sr-only">Editor line number</span></th>
              <th scope="col" className="w-[calc(50%-24px)] text-left pl-3 py-1.5 bg-background">Your Changes (Editor)</th>
            </tr>
          </thead>
          <tbody>
            {diffRows.map((row, idx) => {
              /* Change kind is carried three ways so it never rests on the
               * tint alone: the background/ink pair, a diff-convention
               * marker glyph in the affected cell (+ added, − removed,
               * ± modified), and screen-reader-only row text. */
              let leftBg = '';
              let rightBg = '';
              let leftMark = '';
              let rightMark = '';
              let changeLabel = '';
              if (row.type === 'delete') {
                rightBg = 'bg-green-500/10 text-green-500';
                rightMark = '+';
                changeLabel = 'Line only in your changes';
              } else if (row.type === 'insert') {
                leftBg = 'bg-red-500/10 text-red-500';
                leftMark = '−';
                changeLabel = 'Line only on disk';
              } else if (row.type === 'modify') {
                leftBg = 'bg-amber-500/10 text-amber-500';
                rightBg = 'bg-amber-500/10 text-amber-500';
                leftMark = '±';
                rightMark = '±';
                changeLabel = 'Modified line';
              }

              return (
                <tr key={idx} className="border-b border-muted/10 hover:bg-muted/5 leading-relaxed">
                  {/* Left Line Num */}
                  <td className="w-12 select-none border-r border-muted/30 text-right pr-2 text-2xs text-muted-foreground/60 py-0.5 font-light align-top bg-muted/5">
                    {changeLabel && <span className="sr-only">{changeLabel}. </span>}
                    {row.diskLineNumber ?? ''}
                  </td>
                  {/* Left Content (Disk Version) */}
                  <td className={cn('relative pl-6 pr-2 py-0.5 whitespace-pre-wrap break-all align-top', leftBg)}>
                    <span className="absolute left-1.5 select-none" aria-hidden="true">{leftMark}</span>
                    {row.diskText ?? ''}
                  </td>
                  {/* Right Line Num */}
                  <td className="w-12 select-none border-l border-muted border-r border-muted/30 text-right pr-2 text-2xs text-muted-foreground/60 py-0.5 font-light align-top bg-muted/5">
                    {row.editorLineNumber ?? ''}
                  </td>
                  {/* Right Content (Editor/Your Version) */}
                  <td className={cn('relative pl-6 pr-2 py-0.5 whitespace-pre-wrap break-all align-top', rightBg)}>
                    <span className="absolute left-1.5 select-none" aria-hidden="true">{rightMark}</span>
                    {row.editorText ?? ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
