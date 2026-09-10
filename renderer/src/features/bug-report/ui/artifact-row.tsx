/**
 * One attachment in the checklist: its title and meta line, the include
 * switch, and the collapsed preview. The switch and the preview are wired to
 * two separate callbacks on purpose — opening a preview can never reach the
 * selection, which is the invariant the review contract names.
 */
import { useId } from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { failureMessage } from '@/features/bug-report/application/failure-messages';
import type {
  ArtifactPreview,
  PreviewState,
  ReviewArtifact,
} from '@/features/bug-report/domain/review-session';

import { artifactMeta, artifactTitle, DIAGNOSTIC_ROWS } from './labels';
import { ScreenshotPreview } from './screenshot-preview';

export interface ArtifactRowProps {
  artifact: ReviewArtifact;
  /** Whether the reader can change anything: false outside `reviewing`. */
  editable: boolean;
  /** The selection as the reader sees it, a pending change included. */
  included: boolean;
  onToggleInclude(included: boolean): void;
  onTogglePreview(): void;
  open: boolean;
  preview: PreviewState | undefined;
}

function PreviewBody({ preview }: { preview: ArtifactPreview }) {
  switch (preview.kind) {
    case 'log':
      return (
        <>
          <p className="text-caption text-muted-foreground">
            The exact sanitized excerpt that will be attached.
          </p>
          <ScrollArea
            aria-label="Sanitized bounded application-log excerpt"
            className="rounded-md border border-border bg-surface-2"
            role="group"
            viewportClassName="max-h-72"
          >
            <pre className="p-3 font-mono text-caption whitespace-pre-wrap">{preview.text}</pre>
          </ScrollArea>
        </>
      );
    case 'diagnostics':
      return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-caption">
          {DIAGNOSTIC_ROWS.map(([label, key]) => (
            <div className="contents" key={key}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-mono">{preview.details[key] || 'Unavailable'}</dd>
            </div>
          ))}
        </dl>
      );
    case 'screenshot':
      return <ScreenshotPreview preview={preview} />;
  }
}

function PreviewPanel({ preview }: { preview: PreviewState | undefined }) {
  if (!preview || preview.kind === 'loading') {
    return <p className="text-caption text-muted-foreground">Loading preview…</p>;
  }
  if (preview.kind === 'failed') {
    return <p className="text-caption text-destructive">{failureMessage(preview.failure.kind)}</p>;
  }
  return <PreviewBody preview={preview.preview} />;
}

export function ArtifactRow({
  artifact,
  editable,
  included,
  onToggleInclude,
  onTogglePreview,
  open,
  preview,
}: ArtifactRowProps) {
  const panelId = useId();
  const title = artifactTitle(artifact.kind);
  const available = artifact.availability.kind === 'available';
  return (
    <li className="flex flex-col gap-2 rounded-md border border-border bg-surface-1 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body font-medium">{title}</p>
          <p className="text-caption text-muted-foreground">{artifactMeta(artifact)}</p>
        </div>
        <Switch
          checked={available && included}
          disabled={!available || !editable}
          label={`Include ${title} in the report`}
          labelHidden
          onToggle={() => onToggleInclude(!included)}
        />
      </div>
      {available && (
        <>
          <Button
            aria-controls={panelId}
            aria-expanded={open}
            className="self-start"
            onClick={onTogglePreview}
            size="compact"
            type="button"
            variant="tertiary"
          >
            {artifact.kind === 'diagnostics' ? 'Details' : 'Preview'}
            <span className="sr-only"> for {title}</span>
          </Button>
          {open && (
            <div
              aria-label={`${title} preview`}
              className="flex flex-col gap-2"
              id={panelId}
              role="region"
            >
              <PreviewPanel preview={preview} />
            </div>
          )}
        </>
      )}
    </li>
  );
}
