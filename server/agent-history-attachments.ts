import path from 'node:path';
import { isTransientAttachmentPath, transientAttachmentPreviewUrl } from './routes/attach.ts';

export interface RestoredImageAttachment {
  path: string;
  name: string;
  previewUrl: string;
}

/** Rehydrate the generated attachment suffix into UI attachment data when
 * replaying either supported Agent runtime's persisted transcript. */
export function restoreHistoryImageAttachments(text: string): { text: string; attachments: RestoredImageAttachment[] } {
  const marker = '\n\nAttached files:\n';
  const offset = text.lastIndexOf(marker);
  if (offset < 0) return { text, attachments: [] };
  const before = text.slice(0, offset);
  const attachments: RestoredImageAttachment[] = [];
  const remaining = text.slice(offset + marker.length).split('\n').filter((line) => {
    if (!line.startsWith('- ')) return true;
    const attachment = historyImageAttachment(line.slice(2).trim());
    if (!attachment) return true;
    attachments.push(attachment);
    return false;
  });
  return { text: remaining.length ? `${before}${marker}${remaining.join('\n')}` : before, attachments };
}

/** Build a preview only for an image written by StashBase's transient upload
 * route. Transcript text must never grant read access to arbitrary paths. */
export function historyImageAttachment(candidate: string): RestoredImageAttachment | null {
  if (!isTransientAttachmentPath(candidate) || !isPreviewableImage(candidate)) return null;
  return {
    path: candidate,
    name: path.basename(candidate),
    previewUrl: transientAttachmentPreviewUrl(candidate),
  };
}

function isPreviewableImage(filePath: string): boolean {
  return ['.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp'].includes(path.extname(filePath).toLowerCase());
}
