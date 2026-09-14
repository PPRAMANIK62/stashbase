#!/usr/bin/env node
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { getEmbedderConfig } from '../server/app-config.ts';
import { parseSemanticEvalDataset } from './semantic-retrieval-dataset.ts';
import { runSemanticRetrievalEval, semanticEvalExitCode, type SemanticEvalBackend } from './semantic-retrieval-runner.ts';

const run = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const datasetRoot = path.join(repoRoot, 'evals', 'semantic-retrieval', 'v1');

// `--out <path>` writes the retained release-evidence copy of the report.
const outFlag = process.argv.indexOf('--out');
if (outFlag !== -1 && !process.argv[outFlag + 1]) throw new Error('--out requires a file path');
const outPath = outFlag === -1 ? null : path.resolve(process.argv[outFlag + 1]!);

const dataset = await parseSemanticEvalDataset(
  JSON.parse(await fs.readFile(path.join(datasetRoot, 'dataset.json'), 'utf8')),
  datasetRoot,
);
const embedder = getEmbedderConfig();

if (!embedder.apiKey) {
  throw new Error(
    'Semantic retrieval eval requires an OpenAI or OpenRouter key saved in StashBase Settings > Search by Meaning. Credentials are never read from environment variables.',
  );
}
const { stdout: commitOutput } = await run('git', ['rev-parse', 'HEAD'], { cwd: repoRoot });
const commit = commitOutput.trim();
const { stdout: statusOutput } = await run('git', ['status', '--porcelain'], { cwd: repoRoot });
const workingTreeDirty = statusOutput.trim().length > 0;

const result = await runSemanticRetrievalEval({
  dataset,
  datasetRoot,
  provider: embedder.provider,
  model: embedder.model,
  commit,
  workingTreeDirty,
  async createBackend({ appDataRoot }): Promise<SemanticEvalBackend> {
    // Must precede the imports below: `server/local-data.ts:appDataRoot`
    // reads this to place the vector store and state DB, so the eval never
    // touches the product store.
    process.env.STASHBASE_LOCAL_DATA_ROOT = appDataRoot;
    const [{ MfsIndexer }, { createRetrieval }, { getDaemon }] = await Promise.all([
      import('../server/indexer.mfs.ts'),
      import('../server/retrieval/index.ts'),
      import('../server/mfs-daemon.ts'),
    ]);
    const indexer = new MfsIndexer();
    const { derivedPathsForPdf } = await import('../server/pdf.ts');
    const retrieval = createRetrieval({
      hasEmbeddingKey: () => true,
      hybridSearch: (query, topK, folderRoot, pathPrefix, extensions) =>
        indexer.search(query, topK, folderRoot, pathPrefix, extensions),
      grep: (query, folderRoot, options) => indexer.grep(query, folderRoot, options),
    });
    return {
      bind: (projectRoot) => indexer.bindFolder(projectRoot, embedder),
      indexDirect: async (sourcePath, content) => { await indexer.upsertFile(sourcePath, content); },
      indexPrepared: async (sourcePath, preparedText) => {
        // The synthetic corpus supplies finished PDF text, bypassing the
        // extractor but preserving Retrieval's production freshness boundary.
        if (path.extname(sourcePath).toLowerCase() !== '.pdf') throw new Error('Prepared eval fixtures must be PDF sources');
        const { notePath } = derivedPathsForPdf(sourcePath);
        await fs.mkdir(path.dirname(notePath), { recursive: true });
        await fs.writeFile(notePath, `${preparedText}\n<!-- stashbase-pdf-conversion: complete -->\n`);
        await indexer.upsertConvertedFile(sourcePath, preparedText);
      },
      semanticSearch: async (query, chunkBudget, projectRoot) => {
        const found = await retrieval.search({ mode: 'hybrid', query, folderRoot: projectRoot, topK: chunkBudget });
        return found.evidence.map((item) => item.sourcePath);
      },
      exactSearch: async (query, chunkBudget, projectRoot) => {
        const found = await retrieval.search({ mode: 'grep', query, folderRoot: projectRoot, topK: chunkBudget });
        return found.evidence.map((item) => item.sourcePath);
      },
      close: () => getDaemon().close(),
    };
  },
});

console.log(result.report);
if (outPath) {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${result.report}\n`, 'utf8');
  console.log(`\nReport written to ${outPath}`);
}
process.exitCode = semanticEvalExitCode(result);
