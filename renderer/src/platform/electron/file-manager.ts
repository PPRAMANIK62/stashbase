export function fileManagerLabel(userAgent: string = navigator.userAgent): string {
  if (/Macintosh|Mac OS X/u.test(userAgent)) return 'Show in Finder';
  if (/Windows/u.test(userAgent)) return 'Show in File Explorer';
  return 'Show in file manager';
}
