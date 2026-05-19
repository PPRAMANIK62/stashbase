import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store/AppContext';

const FILE_MIME = 'application/x-stashbase-file';

/**
 * Window-level drag/drop coordinator.
 *
 *  - Veil overlay shows the moment a file drag enters the window
 *    (`dataTransfer.types` includes "Files").
 *  - The folder row / SPACE header under the cursor gets a
 *    `.drop-target` highlight while dragover fires. We compute it from
 *    `e.target.closest(...)` each event because React's drag events on
 *    individual rows fight us if a row scrolls in/out mid-drag.
 *  - On drop we either move an internal file (custom mime present) or
 *    import an external batch via `webkitGetAsEntry` recursion. The
 *    sync-collect-entries-before-await pattern below is **load-bearing**:
 *    Chromium invalidates `DataTransfer.items` on the first `await`,
 *    so an inline loop would silently drop every entry after the first.
 *
 * Returns the boolean veil-visibility flag for `<DropVeil>` to read.
 */
export function useGlobalDragDrop(): boolean {
  const [veilHot, setVeilHot] = useState(false);
  const { actions } = useApp();
  const dragDepth = useRef(0);
  const dropTargetFolder = useRef('');

  useEffect(() => {
    function onDragEnter(e: DragEvent) {
      if (!e.dataTransfer?.types.includes('Files')) return;
      dragDepth.current += 1;
      setVeilHot(true);
    }
    function onDragLeave() {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setVeilHot(false);
    }
    function onDragOver(e: DragEvent) {
      e.preventDefault();
      const tgt = e.target instanceof Element ? e.target : null;
      const folderEl = tgt?.closest('.tree-row.folder') as HTMLElement | null;
      const headEl = !folderEl ? (tgt?.closest('#sideHead') as HTMLElement | null) : null;
      const newTarget = folderEl?.dataset?.path ?? '';

      for (const r of document.querySelectorAll('.tree-row.folder.drop-target')) {
        r.classList.remove('drop-target');
      }
      const head = document.getElementById('sideHead');
      head?.classList.remove('drop-target');
      if (folderEl) folderEl.classList.add('drop-target');
      else if (headEl) head?.classList.add('drop-target');
      dropTargetFolder.current = newTarget;
    }
    async function onDrop(e: DragEvent) {
      e.preventDefault();
      dragDepth.current = 0;
      setVeilHot(false);
      for (const r of document.querySelectorAll('.tree-row.folder.drop-target')) {
        r.classList.remove('drop-target');
      }
      document.getElementById('sideHead')?.classList.remove('drop-target');

      const targetDir = dropTargetFolder.current;
      dropTargetFolder.current = '';

      const internal = e.dataTransfer?.getData(FILE_MIME);
      if (internal) {
        await actions.moveFile(internal, targetDir);
        return;
      }
      const items = e.dataTransfer?.items;
      if (!items || items.length === 0) return;
      // Sync-collect entries before any await — see top-of-file note.
      const entries: FileSystemEntry[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) entries.push(entry);
      }
      const collected: { file: File; relPath: string }[] = [];
      for (const entry of entries) {
        await walkEntry(entry, '', collected);
      }
      if (collected.length) await actions.upload(collected, targetDir);
    }

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [actions]);

  return veilHot;
}

async function walkEntry(
  entry: FileSystemEntry,
  prefix: string,
  out: { file: File; relPath: string }[],
): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((res, rej) =>
      (entry as FileSystemFileEntry).file(res, rej),
    );
    out.push({ file, relPath: prefix + entry.name });
    return;
  }
  if (!entry.isDirectory) return;
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const dirPath = prefix + entry.name + '/';
  // readEntries returns at most ~100 children per call — keep pulling
  // until it yields an empty batch.
  while (true) {
    const batch = await new Promise<FileSystemEntry[]>((res, rej) =>
      reader.readEntries(res, rej),
    );
    if (!batch.length) break;
    for (const child of batch) await walkEntry(child, dirPath, out);
  }
}

