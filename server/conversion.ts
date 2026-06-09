/**
 * Shared "unstructured source → extracted structured markdown" plumbing
 * for the two unstructured formats: PDFs (`pdf_extract.py`) and images
 * (`ocr_extract.py`). Each extracts the file's structured content into a
 * hidden derived `.<sourceBasename>.md` that becomes the single source of
 * truth for that file's indexed content (the binary stays only for
 * viewing). Materialized to disk — unlike HTML's in-memory transform —
 * because these conversions are expensive (subprocess) and worth caching.
 *
 * The two formats differ in only three things — captured by a
 * `ConversionSpec`:
 *   - `matches`     which filenames are convertible sources
 *   - `derivedNote` the dot-prefixed `.<sourceBasename>.md` a source maps to
 *   - `convert`     the actual extractor spawn (PDF emits an extra bundle)
 *
 * Everything else (status tracking, the min-visible timer, the
 * skip-if-note-present guard, the reconcile walk) is identical and lives
 * here so `pdf.ts` / `image.ts` stay thin. Conversion status is persisted
 * to `state.db` via `conversion-status.ts` (shared store) so the sidebar's
 * "Converting…" indicator and the Retry banner cover both kinds.
 */
import fs, { existsSync } from 'node:fs';
import path from 'node:path';
import { clearRecord, hasRecord, listByStatus, markDone, markFailed, markInFlight } from './conversion-status.ts';
import { fromKbRel, toKbRel } from './space.ts';
import { logger } from './log.ts';

const log = logger('conversion');

// Keep the in-flight indicator visible long enough for a 500ms-poll
// client to catch even a sub-second run.
const MIN_VISIBLE_MS = 800;

export interface ConversionSpec {
  /** Short label for logs, e.g. `pdf_extract` / `ocr_extract`. */
  kind: string;
  /** Does this filename look like a convertible source (`.pdf`, image)? */
  matches: (name: string) => boolean;
  /** The dot-prefixed `.<sourceBasename>.md` derived-note path for a source file. */
  derivedNote: (absPath: string) => string;
  /** Run the extractor; resolve on success, reject with the stderr tail. */
  convert: (absPath: string) => Promise<unknown>;
}

/** kbRels with a conversion promise currently pending *in this process*.
 *  This is the ground truth behind the `in-flight` status: a row is only
 *  legitimately in-flight while it's in this set. An `in-flight` row that
 *  isn't (see `reclaimInterruptedConversions`) is a corpse from a crashed
 *  or restarted process — its subprocess was our child and died with us,
 *  so its done/failed transition can never fire on its own. */
const liveConversions = new Set<string>();

/** Run a conversion fire-and-forget, persisting in-flight → done/failed
 *  to `state.db` (when a `kbRel` is known) so the UI can track it. */
function runConversion(absPath: string, kbRel: string | null, spec: ConversionSpec): void {
  log.info(`${spec.kind}: ${absPath} → ${path.basename(spec.derivedNote(absPath))} …`);
  if (kbRel) { markInFlight(kbRel); liveConversions.add(kbRel); }
  const t0 = Date.now();
  // Stay "live" until the exact tick we write done/failed — not when the
  // promise settles. The terminal write is deferred up to MIN_VISIBLE_MS,
  // and during that gap the row is still `in-flight` on disk; dropping it
  // from the live set early would let a concurrent reconcile reclaim a row
  // that's about to be finalized (or stomp a freshly re-queued retry).
  const settle = (fn: () => void) => {
    if (!kbRel) return;
    setTimeout(() => { liveConversions.delete(kbRel); fn(); }, Math.max(0, MIN_VISIBLE_MS - (Date.now() - t0)));
  };
  spec.convert(absPath).then(
    () => {
      log.info(`${spec.kind}: done in ${Date.now() - t0}ms (${path.basename(spec.derivedNote(absPath))})`);
      settle(() => markDone(kbRel!));
    },
    (err: Error) => {
      log.warn(`${spec.kind}: failed for ${absPath}: ${err.message}`);
      settle(() => markFailed(kbRel!, err.message));
    },
  );
}

/** Run an arbitrary background job under the same in-flight tracking the
 *  file converters use, keyed to `kbRel` so it surfaces in the sidebar's
 *  "Converting…" banner (`getInFlightConversions`). Unlike `runConversion`
 *  there's no source file on disk — used by the recording pipeline, where
 *  the video is processed from a temp file and only a note lands in the
 *  space. On failure we `clearRecord` rather than `markFailed`: there's no
 *  re-runnable source, so the Retry affordance would be a dead end. */
export function runBackgroundConversion(kbRel: string, work: () => Promise<void>): Promise<void> {
  markInFlight(kbRel);
  liveConversions.add(kbRel);
  const t0 = Date.now();
  const settle = (fn: () => void) => {
    setTimeout(() => { liveConversions.delete(kbRel); fn(); }, Math.max(0, MIN_VISIBLE_MS - (Date.now() - t0)));
  };
  return work().then(
    () => { settle(() => markDone(kbRel)); },
    (err: Error) => {
      log.warn(`background conversion failed for ${kbRel}: ${err.message}`);
      settle(() => clearRecord(kbRel));
    },
  );
}

/** Reclaim `in-flight` rows orphaned by a crash/restart: any in-flight
 *  record with no live promise in this process (see `liveConversions`)
 *  can never settle on its own, so clearing it lets the reconcile walk
 *  that follows (`discoverNewSources`) re-decide idempotently — back-fill
 *  `done` if the derived note actually landed before the crash, re-queue
 *  the conversion if it didn't, or drop it entirely if the source is gone.
 *  Without this a half-finished conversion sticks the sidebar on
 *  "Converting…" forever. Safe to call on every reconcile: genuinely
 *  running conversions are in `liveConversions` and so are never touched. */
export function reclaimInterruptedConversions(): void {
  for (const { path: kbRel } of listByStatus('in-flight')) {
    if (liveConversions.has(kbRel)) continue;
    log.info(`reclaiming interrupted conversion: ${kbRel}`);
    clearRecord(kbRel);
  }
}

/** Fire-and-forget convert used by the upload route. Skips silently if
 *  the derived note already exists (re-drop of the same source). Runs
 *  even without a space context, just without status tracking. */
export function maybeConvert(absPath: string, spaceRelative: string, spec: ConversionSpec): void {
  if (existsSync(spec.derivedNote(absPath))) {
    log.info(`${spec.kind}: skipped ${absPath} — ${path.basename(spec.derivedNote(absPath))} already present`);
    return;
  }
  let kbRel: string | null = null;
  try {
    kbRel = toKbRel(spaceRelative);
  } catch {
    // No current space — shouldn't happen at upload time; convert anyway,
    // just skip status tracking.
    log.warn(`${spec.kind}: no space context, status tracking skipped: ${absPath}`);
  }
  runConversion(absPath, kbRel, spec);
}

/** Reconcile hook: walk `spaceAbs` for convertible sources with no status
 *  record and queue them — so files dropped in out-of-band (git checkout,
 *  external copy, `mv`) get converted on the next open of the space.
 *  Back-fills a `done` record when the sibling note already exists
 *  (converted upstream) so this doesn't re-fire every reconcile. */
export function discoverNewSources(spaceAbs: string, spec: ConversionSpec): void {
  walkSources(spaceAbs, '', spec, (rel, abs) => {
    let kbRel: string;
    try { kbRel = toKbRel(rel); } catch { return; }
    if (hasRecord(kbRel)) return;
    if (existsSync(spec.derivedNote(abs))) { markDone(kbRel); return; }
    log.info(`reconcile: queueing untracked ${spec.kind} source ${rel}`);
    runConversion(abs, kbRel, spec);
  });
}

/** Space-relative paths of every source (PDF or image) whose conversion is
 *  currently in-flight, scoped to the current space. The /api/index-status
 *  route reads this so the sidebar can render a "Converting…" indicator and
 *  auto-reload once the entry disappears (= the derived note has landed on
 *  disk). Backed by the KB-wide `conversions` table; we filter to the
 *  current space here so the sidebar's space-relative view stays correct. */
export function getInFlightConversions(): string[] {
  const out: string[] = [];
  for (const { path: kbRel } of listByStatus('in-flight')) {
    const spaceRel = fromKbRel(kbRel);
    if (spaceRel != null) out.push(spaceRel);
  }
  out.sort();
  return out;
}

function walkSources(
  dir: string,
  prefix: string,
  spec: ConversionSpec,
  fn: (rel: string, full: string) => void,
): void {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    // Skip hidden / sidecar / git plumbing and derived `_files` bundles.
    if (e.name.startsWith('.')) continue;
    if (e.isDirectory() && e.name.endsWith('_files')) continue;
    const full = path.join(dir, e.name);
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) walkSources(full, rel, spec, fn);
    else if (e.isFile() && spec.matches(e.name)) fn(rel, full);
  }
}
