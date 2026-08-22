import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { bytesToHex } from '@noble/hashes/utils.js';
import { blake3 } from '@noble/hashes/blake3.js';
import { hasCompleteBaselines, resolveDatasetPath, type SemanticEvalDataset } from './semantic-retrieval-dataset.ts';
import { scoreRankedQueries, type RankedQueryResult } from './semantic-retrieval-metrics.ts';

export interface SemanticEvalBackend {
  bind(libraryRoot: string): Promise<void>;
  indexDirect(sourcePath: string, content: string): Promise<void>;
  indexPrepared(sourcePath: string, preparedText: string, sourceHash: string): Promise<void>;
  semanticSearch(query: string, topK: number, libraryRoot: string): Promise<string[]>;
  exactSearch(query: string, topK: number, libraryRoot: string): Promise<string[]>;
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

export async function runSemanticRetrievalEval(options: SemanticEvalRunnerOptions): Promise<SemanticEvalRunResult> {
  const makeScratch = options.makeScratch ?? (() => fs.mkdtemp(path.join(os.tmpdir(), 'stashbase-semantic-eval-')));
  const removeScratch = options.removeScratch ?? ((scratch) => fs.rm(scratch, { recursive: true, force: true }));
  let scratch: string | null = null;
  let backend: SemanticEvalBackend | null = null;
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
      const sourceBytes = await fs.readFile(fixture);
      await fs.writeFile(destination, sourceBytes);
      if (document.kind === 'direct') {
        await backend.indexDirect(destination, sourceBytes.toString('utf8'));
      } else {
        const preparedFixture = resolveDatasetPath(options.datasetRoot, document.preparedText, `prepared ${document.preparedText}`);
        const prepared = await fs.readFile(preparedFixture, 'utf8');
        await backend.indexPrepared(destination, prepared, bytesToHex(blake3(sourceBytes)));
      }
    }

    const ranked: RankedQueryResult[] = [];
    for (const query of options.dataset.queries) {
      const semantic = await backend.semanticSearch(query.text, options.dataset.topK, libraryRoot);
      const exact = query.compareExact
        ? await backend.exactSearch(query.text, options.dataset.topK, libraryRoot)
        : null;
      ranked.push({
        id: query.id,
        query: query.text,
        relevant: query.relevant,
        ranked: semantic.map((source) => relativeSource(libraryRoot, source)),
        ...(exact ? { exactRanked: exact.map((source) => relativeSource(libraryRoot, source)) } : {}),
      });
    }

    const scored = scoreRankedQueries(ranked, options.dataset.topK);
    const passed = scored.recallAtK >= options.dataset.thresholds.recallAtK
      && scored.meanReciprocalRank >= options.dataset.thresholds.meanReciprocalRank;
    const gateReady = hasCompleteBaselines(options.dataset, options.provider, options.model);
    const lines = [
      `Semantic retrieval evaluation: ${passed ? 'PASS' : 'FAIL'}`,
      `Dataset: ${options.dataset.datasetVersion} (schema ${options.dataset.schemaVersion})`,
      `Commit: ${options.commit}`,
      `Provider: ${options.provider}`,
      `Model: ${options.model}`,
      `Gate status: ${gateReady ? 'ACTIVE' : 'CALIBRATION — baseline runs incomplete'}`,
      `Top K: ${options.dataset.topK}`,
      `Recall@${options.dataset.topK}: ${scored.recallAtK.toFixed(3)} (threshold ${options.dataset.thresholds.recallAtK.toFixed(3)})`,
      `MRR: ${scored.meanReciprocalRank.toFixed(3)} (threshold ${options.dataset.thresholds.meanReciprocalRank.toFixed(3)})`,
    ];
    for (const query of scored.queries) {
      const status = query.firstRelevantRank == null ? 'MISS' : `rank ${query.firstRelevantRank}`;
      lines.push('', `[${status}] ${query.id}: ${query.query}`);
      lines.push(`  expected: ${query.relevant.join(' OR ')}`);
      lines.push(`  similar: ${query.ranked.length ? query.ranked.join(', ') : '(no results)'}`);
      if (query.exactRanked) lines.push(`  exact: ${query.exactRanked.length ? query.exactRanked.join(', ') : '(no results)'}`);
    }
    return { passed, gateReady, report: lines.join('\n'), recallAtK: scored.recallAtK, meanReciprocalRank: scored.meanReciprocalRank };
  } finally {
    try { await backend?.close(); }
    finally { if (scratch) await removeScratch(scratch); }
  }
}
