/** Platform-native copy for the one operation shared by unavailable
 * document states and non-expandable workspace folders. */
export function showInFileManagerLabel(): string {
  const platform = (navigator.platform || '').toLowerCase();
  if (platform.includes('mac')) return 'Show in Finder';
  if (platform.includes('win')) return 'Show in File Explorer';
  return 'Show in File Manager';
}
