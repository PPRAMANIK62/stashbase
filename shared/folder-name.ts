/**
 * Validate one portable folder-name segment shared by the renderer and server.
 * The returned string is suitable for inline validation; `null` means valid.
 */
export function validateFolderName(name: unknown): string | null {
  if (typeof name !== 'string' || !name.trim()) return 'name required';
  const normalized = name.trim();
  if (normalized === '.' || normalized === '..') return 'name cannot be "." or ".."';
  if (normalized.startsWith('.')) return 'name cannot start with "."';
  if (normalized.endsWith('.')) return 'name cannot end with "."';
  if (normalized.includes('/') || normalized.includes('\\')) return 'name cannot contain slashes';
  // eslint-disable-next-line no-control-regex
  if (/[<>:"|?*\u0000-\u001f]/.test(normalized)) {
    return 'name cannot contain < > : " | ? * or control characters';
  }
  if (normalized.length > 64) return 'name too long (max 64 chars)';
  return null;
}
