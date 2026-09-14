import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  resolveAudioMediaToolchain,
  resolveWhisperToolchain,
  runTranscriptionTool,
} from './transcription-tools.ts';

test('audio media tool resolution does not require a local whisper runtime', () => {
  const keys = [
    'STASHBASE_FFMPEG_BIN',
    'STASHBASE_FFPROBE_BIN',
    'STASHBASE_WHISPER_BIN',
  ] as const;
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.STASHBASE_FFMPEG_BIN = process.execPath;
    process.env.STASHBASE_FFPROBE_BIN = process.execPath;
    process.env.STASHBASE_WHISPER_BIN = path.join(process.cwd(), 'missing-whisper-cli');

    assert.deepEqual(resolveAudioMediaToolchain(), {
      ffmpeg: process.execPath,
      ffprobe: process.execPath,
    });
    assert.throws(resolveWhisperToolchain, /STASHBASE_WHISPER_BIN does not point to a file/);
  } finally {
    for (const key of keys) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('native transcription tools are terminated after their deadline', async () => {
  await assert.rejects(
    runTranscriptionTool(process.execPath, ['-e', 'setInterval(() => undefined, 1000)'], { timeoutMs: 50 }),
    /timed out after 1s/,
  );
});

test('native transcription tools expose complete stdout progress lines across chunks', async () => {
  const lines: string[] = [];
  await runTranscriptionTool(process.execPath, [
    '-e',
    "process.stdout.write('out_time_us=12'); process.stdout.write('3456\\nprogress=continue\\n')",
  ], { onStdoutLine: (line) => lines.push(line) });
  assert.deepEqual(lines, ['out_time_us=123456', 'progress=continue']);
});

test('native transcription tools wait for inherited stdout to close', async () => {
  const child = [
    "const { spawn } = require('node:child_process')",
    "spawn(process.execPath, ['-e', \"setTimeout(() => process.stdout.write('late-output\\\\n'), 40)\"], { detached: true, stdio: ['ignore', process.stdout, 'ignore'] }).unref()",
  ].join(';');
  const { stdout } = await runTranscriptionTool(process.execPath, ['-e', child]);
  assert.match(stdout, /late-output/);
});

for (const trigger of ['cancel', 'timeout'] as const) {
  test(`native ${trigger} kills a stubborn descendant after its parent exits`, {
    skip: process.platform === 'win32', timeout: 8_000,
  }, async (t) => {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-tool-tree-'));
    const pidFile = path.join(root, 'child.pid');
    let childPid: number | undefined;
    t.after(() => {
      if (childPid) { try { process.kill(childPid, 'SIGKILL'); } catch { /* already gone */ } }
      fs.rmSync(root, { recursive: true, force: true });
    });
    const child = `process.on('SIGTERM',()=>{});require('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid));console.log('ready');setInterval(()=>{},1000);`;
    const parent = `require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(child)}],{stdio:['ignore',process.stdout,process.stderr]});setInterval(()=>{},1000);`;
    const controller = new AbortController();
    let ready!: () => void;
    const started = new Promise<void>((resolve) => { ready = resolve; });
    const work = runTranscriptionTool(process.execPath, ['-e', parent], {
      signal: controller.signal,
      timeoutMs: trigger === 'timeout' ? 1000 : 6000,
      onStdoutLine: (line) => { if (line === 'ready') ready(); },
    });
    const rejected = assert.rejects(work, trigger === 'cancel' ? /cancelled/ : /timed out/);
    await started;
    childPid = Number(fs.readFileSync(pidFile, 'utf8'));
    if (trigger === 'cancel') controller.abort();
    await rejected;
    // Pipe retirement must come from killing the descendant, not an early
    // promise rejection that leaves native work running behind the scheduler.
    const deadline = Date.now() + 1000;
    while (Date.now() < deadline) {
      try { process.kill(childPid, 0); } catch { childPid = undefined; break; }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(childPid, undefined);
  });
}
