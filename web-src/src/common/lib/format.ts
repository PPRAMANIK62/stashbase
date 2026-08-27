/** Byte counts → user-facing "N MiB" copy (model downloads, indexing
 * workload estimates). Whole numbers from 10 MiB up; one decimal below
 * that so a small workload doesn't read as "0 MiB". */
export function formatMiB(bytes: number): string {
  const mib = bytes / (1024 * 1024);
  return `${mib.toFixed(mib >= 10 ? 0 : 1)} MiB`;
}

/**
 * The same rounding rule stepped down through KiB and bytes, for surfaces
 * that show a single file's size rather than a workload.
 *
 * Binary units are spelled honestly. A private copy of this divided by
 * 1024² and then labelled the result "MB", so the same file read as
 * "4.2 MiB" in Settings and "4.2 MB" in the document viewer.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kib = bytes / 1024;
    return `${kib.toFixed(kib >= 10 ? 0 : 1)} KiB`;
  }
  return formatMiB(bytes);
}
