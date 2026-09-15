import { VIDEO_SOURCE_EXTENSIONS } from '@/contracts/file-formats';

export type MediaKind = 'audio' | 'video';

export function mediaKind(path: string): MediaKind {
  const extension = path.split('.').at(-1)?.toLowerCase() ?? '';
  return extension && VIDEO_SOURCE_EXTENSIONS.some((candidate) => candidate === extension)
    ? 'video'
    : 'audio';
}
