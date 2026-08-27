import type { GenericFilePreview } from '@/common/api/api';
import { FileTypeIcon } from '@/common/components/FileTypeIcon';
import { Button } from '@/common/components/ui/button';
import { EmptyState } from '@/common/components/ui/empty-state';
import { SectionHeading } from '@/common/components/ui/section';
import { useAppActions } from '@/store/contexts/AppContext';
import { TextDocument } from '@/features/documents/components/TextDocument';
import { showInFileManagerLabel } from '@/common/lib/fileManager';
import { formatBytes } from '@/common/lib/format';

export function GenericFileViewer({ tabId, preview }: {
  tabId: string;
  preview: GenericFilePreview;
}) {
  const { actions } = useAppActions();
  if (preview.kind === 'text') {
    return <TextDocument tabId={tabId} content={preview.content} readOnly active fileName={preview.name} />;
  }

  const { title, description } = genericPreviewCopy(preview);
  /* One cluster, three groups: message (glyph, title, explanation), then
   * the path-and-size caption, then the action — margins carry the
   * grouping, so no uniform gap. The path sits BELOW the explanation in
   * caption tone: the tab already names the file, and a foreground mono
   * path outshouted the sentence that says what happened.
   *
   * The glyph runs at the ordinary 16px chrome step, not blown up as a
   * hero mark. The icon ramp is three steps (12/14/16) and hierarchy comes
   * from colour, weight and text — never from glyph size; a 40px solid
   * Phosphor silhouette is a mass rather than a glyph, and dimming it to
   * compensate solved a size problem with colour. */
  return (
    <EmptyState layout="fill" role="status">
      <span className="block size-4 text-muted-foreground [&_svg]:size-full"><FileTypeIcon format="generic" /></span>
      <SectionHeading level={2} className="mt-3 font-medium">{title}</SectionHeading>
      <p className="m-0 mt-1.5 w-measure-sm leading-normal text-muted-foreground">{description}</p>
      <p className="m-0 mt-3 w-measure-sm break-all font-mono text-xs text-muted-foreground">
        {preview.name}{preview.size != null && <> · {formatBytes(preview.size)}</>}
      </p>
      <Button variant="outline" size="sm" className="mt-5" onClick={() => actions.revealFile(preview.name)}>
        {showInFileManagerLabel()}
      </Button>
    </EmptyState>
  );
}

function genericPreviewCopy(preview: Exclude<GenericFilePreview, { kind: 'text' }>): {
  title: string;
  description: string;
} {
  if (preview.kind === 'too-large') {
    return {
      title: 'File is too large to open',
      description: 'StashBase does not load text files larger than 8 MiB into the document viewer.',
    };
  }
  if (preview.kind === 'unreadable') {
    return {
      title: 'File cannot be read',
      description: 'Check the file permissions or use the system file manager for more details.',
    };
  }
  if (preview.kind === 'cloud-placeholder') {
    return {
      title: 'File is not downloaded',
      description: 'Download this cloud file in the system file manager, then open it again.',
    };
  }
  if (preview.kind === 'symlink') {
    return {
      title: 'Symbolic link cannot be opened',
      description: 'StashBase shows symbolic links in the tree but does not follow them.',
    };
  }
  if (preview.kind === 'special') {
    return {
      title: 'Filesystem entry cannot be opened',
      description: 'This entry is not a regular file.',
    };
  }
  return {
    title: 'Binary file cannot be opened',
    description: 'This file is binary or uses an unsupported text encoding, so StashBase cannot display it.',
  };
}

