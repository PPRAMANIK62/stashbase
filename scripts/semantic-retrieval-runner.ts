import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { blake3File } from '../server/file-hash.ts';
import { hasCompleteBaselines, resolveDatasetPath, type SemanticEvalDataset } from './semantic-retrieval-dataset.ts';
import { scoreRankedQueries, type RankedQueryResult } from './semantic-retrieval-metrics.ts';

/** Retrieval ranks chunks, not documents, so a single long source can fill
 *  every slot of a document-level top-K. Ask the index for this multiple of
 *  `topK` chunks and collapse them to distinct sources afterwards, so the
 *  reported rank stays a DOCUMENT rank even when the corpus grows sources
 *  that chunk into many pieces. */
export const CHUNK_FETCH_MULTIPLIER = 10;

export interface SemanticEvalBackend {
  bind(libraryRoot: string): Promise<void>;
  indexDirect(sourcePath: string, content: string): Promise<void>;
  indexPrepared(sourcePath: string, preparedText: string, sourceHash: string): Promise<void>;
  /** `chunkBudget` is a chunk count, deliberately larger than the dataset's
   *  `topK`; the runner reduces the reply to distinct sources. */
  semanticSearch(query: string, chunkBudget: number, libraryRoot: string): Promise<string[]>;
  exactSearch(query: string, chunkBudget: number, libraryRoot: string): Promise<string[]>;
  close(): Promise<void>;
}

export interface SemanticEvalRunResult {
  passed: boolean;
  report: string;
  recallAtK: number;
  meanReciprocalRank: number;
  gateReady: boolean;
}

export interface SemanticEvalRunnerOptions {
  dataset: SemanticEvalDataset;
  datasetRoot: string;
  provider: string;
  model: string;
  commit: string;
  /** True when the working tree carried uncommitted changes. A retained
   *  report is release evidence, so it must not name a commit that is not
   *  what actually ran. */
  workingTreeDirty?: boolean;
  createBackend(context: { libraryRoot: string; appDataRoot: string }): Promise<SemanticEvalBackend>;
  makeScratch?: () => Promise<string>;
  removeScratch?: (scratch: string) => Promise<void>;
}

export function semanticEvalExitCode(result: Pick<SemanticEvalRunResult, 'gateReady' | 'passed'>): 0 | 1 {
  return result.gateReady && !result.passed ? 1 : 0;
}

function relativeSource(libraryRoot: string, source: string): string {
  const root = path.resolve(libraryRoot);
  const resolved = path.resolve(source);
  const rel = path.relative(root, resolved);
  if (!rel || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error(`retrieval returned a source outside the evaluation library: ${source}`);
  }
  return rel.split(path.sep).join('/');
}

/** Chunk/match hits → distinct sources in first-seen rank order. */
function distinctSources(libraryRoot: string, hits: readonly string[]): string[] {
  const seen = new Set<string>();
  const sources: string[] = [];
  for (const hit of hits) {
    const source = relativeSource(libraryRoot, hit);
    if (seen.has(source)) continue;
    seen.add(source);
    sources.push(source);
  }
  return sources;
}

export async function runSemanticRetrievalEval(options: SemanticEvalRunnerOptions): Promise<SemanticEvalRunResult> {
  const makeScratch = options.makeScratch ?? (() => fs.mkdtemp(path.join(os.tmpdir(), 'stashbase-semantic-eval-')));
  const removeScratch = options.removeScratch ?? ((scratch) => fs.rm(scratch, { recursive: true, force: true }));
  let scratch: string | null = null;
  let backend: SemanticEvalBackend | null = null;
  let failure: unknown = null;
  try {
    scratch = await makeScratch();
    const libraryRoot = path.join(scratch, 'library');
    const appDataRoot = path.join(scratch, 'app-data');
    await fs.mkdir(libraryRoot, { recursive: true });
    backend = await options.createBackend({ libraryRoot, appDataRoot });
    await backend.bind(libraryRoot);

    for (const document of options.dataset.documents) {
      const fixture = resolveDatasetPath(options.datasetRoot, document.path, `document ${document.path}`);
      const destination = path.resolve(libraryRoot, document.path);
      relativeSource(libraryRoot, destination);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(fixture, destination);
      if (document.kind === 'direct') {
        await backend.indexDirect(destination, await fs.readFile(destination, 'utf8'));
      } else {
        const preparedFixture = resolveDatasetPath(options.datasetRoot, document.preparedText, `prepared ${document.preparedText}`);
        const prepared = await fs.readFile(preparedFixture, 'utf8');
        // Same source-byte hash the production convertible path stamps.
        await backend.indexPrepared(destination, prepared, await blake3File(destination));
      }
    }

    const chunkBudget = options.dataset.topK * CHUNK_FETCH_MULTIPLIER;
    const ranked: RankedQueryResult[] = [];
    for (const query of options.dataset.queries) {
      const semantic = await backend.semanticSearch(query.text, chunkBudget, libraryRoot);
      const exact = query.compareExact
        ? await backend.exactSearch(query.text, chunkBudget, libraryRoot)
        : null;
      ranked.push({
        id: query.id,
        query: query.text,
        relevant: query.relevant,
        ranked: distinctSources(libraryRoot, semantic),
        ...(exact ? { exactRanked: distinctSources(libraryRoot, exact) } : {}),
      });
    }

    const scored = scoreRankedQueries(ranked, options.dataset.topK);
    const passed = scored.recallAtK >= options.dataset.thresholds.recallAtK
      && scored.meanReciprocalRank >= options.dataset.thresholds.meanReciprocalRank;
    const gateReady = hasCompleteBaselines(options.dataset, options.provider, options.model);
    const topK = options.dataset.topK;
    const lines = [
      `Semantic retrieval evaluation: ${passed ? 'PASS' : 'FAIL'}`,
      `Dataset: ${options.dataset.datasetVersion} (schema ${options.dataset.schemaVersion})`,
      `Commit: ${options.commit}${options.workingTreeDirty ? ' (DIRTY WORKING TREE — not reproducible from this commit)' : ''}`,
      `Provider: ${options.provider}`,
      `Model: ${options.model}`,
      `Gate status: ${gateReady ? 'ACTIVE' : 'CALIBRATION — baseline runs incomplete'}`,
      `Top K: ${topK} distinct sources (retrieved from up to ${chunkBudget} chunks)`,
      `Recall@${topK}: ${scored.recallAtK.toFixed(3)} (threshold ${options.dataset.thresholds.recallAtK.toFixed(3)})`,
      `MRR: ${scored.meanReciprocalRank.toFixed(3)} (threshold ${options.dataset.thresholds.meanReciprocalRank.toFixed(3)})`,
    ];
    for (const query of scored.queries) {
      const status = query.firstRelevantRank == null ? 'MISS' : `rank ${query.firstRelevantRank}`;
      lines.push('', `[${status}] ${query.id}: ${query.query}`);
      lines.push(`  expected: ${query.relevant.join(' OR ')}`);
      lines.push(`  similar: ${query.ranked.length ? query.ranked.slice(0, topK).join(', ') : '(no results)'}`);
      if (query.exactRanked) {
        lines.push(`  exact: ${query.exactRanked.length ? query.exactRanked.slice(0, topK).join(', ') : '(no results)'}`);
      }
    }
    return { passed, gateReady, report: lines.join('\n'), recallAtK: scored.recallAtK, meanReciprocalRank: scored.meanReciprocalRank };
  } catch (err) {
    failure = err;
    throw err;
  } finally {
    // A close() failure must not replace the error that actually ended the
    // run, but it must still surface when the run itself succeeded.
    try { await backend?.close(); }
    catch (err) { if (failure == null) throw err; }
    finally { if (scratch) await removeScratch(scratch); }
  }
}
