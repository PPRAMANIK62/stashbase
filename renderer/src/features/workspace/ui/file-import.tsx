import { useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import type { UploadPort } from '@/features/workspace/application/ports';
import type { WorkspaceRuntime } from '@/features/workspace/application/runtime';
import { useFileImport } from '@/features/workspace/hooks/use-file-import';
import { FailureNotice } from '@/shared/ui/failure-notice';

/** Native file drops here copy into the project. Chat owns its separate drops. */
export function FileImport({
  api,
  children,
  runtime,
}: {
  api: UploadPort;
  children: (importAction: { disabled: boolean; run(): void }) => ReactNode;
  runtime: WorkspaceRuntime;
}) {
  const [folderDropped, setFolderDropped] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const state = useFileImport(runtime, api);
  return (
    <div
      role="group"
      aria-label="Import project files"
      onDragOverCapture={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = state.pending ? 'none' : 'copy';
      }}
      onDropCapture={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        event.stopPropagation();
        const hasFolder = Array.from(event.dataTransfer.items).some(
          (item) => item.webkitGetAsEntry()?.isDirectory,
        );
        setFolderDropped(hasFolder);
        if (!hasFolder) void state.importFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <div className="px-2">
        <input
          aria-label="Choose files to import"
          hidden
          multiple
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = '';
            setFolderDropped(false);
            void state.importFiles(files);
          }}
          ref={input}
          type="file"
        />
        {folderDropped && (
          <p className="text-caption text-muted-foreground">
            Choose files to import. To use a whole folder, open it as a project.
          </p>
        )}
        {state.failure && <FailureNotice failure={state.failure} />}
        <div aria-live="polite" className="text-caption text-muted-foreground">
          {state.pending && <p>Importing…</p>}
          {state.imported > 0 && (
            <p>
              {state.imported} {state.imported === 1 ? 'file' : 'files'} imported.
            </p>
          )}
          {state.refused.length > 0 && (
            <>
              <p>Could not import: {state.refused.map((file) => file.name).join(', ')}</p>
              <Button
                disabled={state.pending}
                onClick={() => void state.importFiles(state.refused)}
                size="compact"
                variant="ghost"
              >
                Retry these files
              </Button>
            </>
          )}
        </div>
      </div>
      {children({ disabled: state.pending, run: () => input.current?.click() })}
    </div>
  );
}
