import {
  FileAudio,
  FileCode2,
  FileImage,
  FileJson2,
  FileQuestion,
  FileText,
  FileType2,
  FileVideo,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';

const EXTENSION_ICONS: Record<string, LucideIcon> = {
  aac: FileAudio,
  avi: FileVideo,
  bmp: FileImage,
  css: FileCode2,
  docx: FileText,
  flac: FileAudio,
  gif: FileImage,
  heic: FileImage,
  htm: FileCode2,
  html: FileCode2,
  jpeg: FileImage,
  jpg: FileImage,
  js: FileCode2,
  json: FileJson2,
  jsx: FileCode2,
  m4a: FileAudio,
  m4v: FileVideo,
  md: FileText,
  mov: FileVideo,
  mp3: FileAudio,
  mp4: FileVideo,
  ogg: FileAudio,
  pdf: FileType2,
  png: FileImage,
  svg: FileImage,
  ts: FileCode2,
  tsx: FileCode2,
  txt: FileText,
  wav: FileAudio,
  webm: FileVideo,
  webp: FileImage,
};

interface FileTypeIconProps extends LucideProps {
  path: string;
}

export function FileTypeIcon({ path, ...props }: FileTypeIconProps) {
  const basename = path.slice(path.lastIndexOf('/') + 1);
  const separator = basename.lastIndexOf('.');
  const extension = separator === -1 ? '' : basename.slice(separator + 1).toLowerCase();
  const Icon = EXTENSION_ICONS[extension] ?? FileQuestion;
  return <Icon {...props} />;
}
