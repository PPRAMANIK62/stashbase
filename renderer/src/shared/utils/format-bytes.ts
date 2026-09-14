/**
 * A byte count as a reader should see it.
 *
 * One ladder for the whole app. The same file was being sized three different
 * ways depending on which screen asked — a transcription model, a bug-report
 * attachment and a JSON document each carried their own version — so a
 * 500-byte file could read as `512 B` on one surface and `1 KB` on another.
 *
 * Binary units throughout, because these are file sizes on disk and every
 * other size the operating system shows the reader is binary. Precision falls
 * away as the number grows: one decimal is worth reading at `1.5 KB` and noise
 * at `340.2 KB`.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${scaled(kilobytes)} KB`;
  const megabytes = kilobytes / 1024;
  if (megabytes < 1024) return `${scaled(megabytes)} MB`;
  return `${(megabytes / 1024).toFixed(1)} GB`;
}

/** A decimal below ten, a whole number above it. */
function scaled(value: number): string {
  return value < 10 ? value.toFixed(1) : String(Math.round(value));
}
