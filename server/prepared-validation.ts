import { Worker, isMarkedAsUntransferable } from 'node:worker_threads';
import { parseAudioTranscript } from './audio-transcript.ts';

type Task = { kind: 'docx' | 'audio'; bytes: Uint8Array };
export type AudioPreparedIdentity = { size: number; mtimeMs: number; statIdentity: string; contentHash: string };

const WORKER_SOURCE = String.raw`
const { parentPort, workerData } = require('node:worker_threads');
const parseAudioTranscript = (${parseAudioTranscript.toString()});
function docxHasText(html) {
  const text = html.replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/\s*(p|div|section|article|li|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(Number(n)); } catch { return ''; } })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(Number.parseInt(n, 16)); } catch { return ''; } });
  return text.trim().length > 0;
}
function audioIdentity(text) {
  const { source } = parseAudioTranscript(JSON.parse(text));
  return { size: source.size, mtimeMs: source.mtimeMs, statIdentity: source.statIdentity, contentHash: source.contentHash };
}
try {
  const text = Buffer.from(workerData.bytes).toString('utf8');
  parentPort.postMessage({ ok: true, value: workerData.kind === 'docx' ? docxHasText(text) : audioIdentity(text) });
}
catch (error) { parentPort.postMessage({ ok: false, error: error && error.message ? error.message : String(error) }); }
`;

const MAX_WORKERS = 2;
let active = 0;
const waiters: Array<() => void> = [];

async function run<T>(task: Task): Promise<T> {
  if (active >= MAX_WORKERS) await new Promise<void>((resolve) => waiters.push(resolve));
  active += 1;
  try {
    return await new Promise<T>((resolve, reject) => {
      const worker = new Worker(WORKER_SOURCE, {
        eval: true,
        workerData: task,
        // Small Node Buffers share an untransferable pool. Clone those;
        // dedicated large file buffers can still transfer without copying.
        transferList: isMarkedAsUntransferable(task.bytes.buffer) ? [] : [task.bytes.buffer as ArrayBuffer],
      });
      let settled = false;
      const fail = (error: Error) => { if (!settled) { settled = true; reject(error); } };
      worker.once('message', (message: { ok: boolean; value?: T; error?: string }) => {
        if (settled) return;
        settled = true;
        void worker.terminate();
        message.ok ? resolve(message.value as T) : reject(new Error(message.error ?? 'prepared validation failed'));
      });
      worker.once('error', fail);
      worker.once('exit', (code) => { if (code !== 0) fail(new Error(`prepared validation worker exited with code ${code}`)); });
    });
  } finally {
    active -= 1;
    waiters.shift()?.();
  }
}

export const validatePreparedDocxText = (bytes: Buffer): Promise<boolean> => run({ kind: 'docx', bytes });
export const validatePreparedAudioTranscript = (bytes: Buffer): Promise<AudioPreparedIdentity> => run({ kind: 'audio', bytes });
