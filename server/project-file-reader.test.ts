import './__tests__/isolated-home.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { AudioTranscription } from './audio-transcription.ts';
import { clearRecord, markCancelled, markFailed } from './conversion-status.ts';
import { derivedNoteFor, derivedTranscriptFor, registerDerivedSource } from './derived-store.ts';
import { derivedHtmlPathForDocx } from './docx.ts';
import { registerProjectFolderAsync } from './folder.ts';
import { agentContextFile, readProjectFile } from './project-file-reader.ts';
import { registerAttributedAgentSession, unregisterAttributedAgentSession } from './agent-session-registry.ts';
import { withAgentProjectScope } from './project-request-scope.ts';
import { filesystemPath } from './filesystem-path.ts';

test('prepared reads and context require a current source and complete output, including legacy derived paths', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-prepared-read-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  await registerProjectFolderAsync(root);
  for (const format of ['pdf', 'docx', 'audio'] as const) {
    await t.test(format, async () => {
      const source = path.join(root, format === 'audio' ? 'recording.wav' : `document.${format}`);
      fs.writeFileSync(source, 'source bytes');
      fs.utimesSync(source, 100, 100);
      registerDerivedSource(source);
      const derived = format === 'docx' ? derivedHtmlPathForDocx(source) : derivedNoteFor(source);
      if (format === 'audio') {
        await new AudioTranscription({
          id: 'fixture', version: '1',
          transcribe: async () => ({ language: 'en', segments: [{ startMs: 0, endMs: 1000, text: 'prepared speech' }] }),
        }, {
          probe: async () => ({ durationMs: 2000 }),
          decodeChunk: async ({ wavPath }) => { fs.writeFileSync(wavPath, 'wav'); },
          createPreview: async (_source, preview) => { fs.writeFileSync(preview, 'preview'); },
        }).prepare(source, { model: { id: 'tiny' }, language: 'auto' });
      } else {
        fs.mkdirSync(path.dirname(derived), { recursive: true });
        fs.writeFileSync(derived, format === 'docx'
          ? '<p>prepared document</p>\n<!-- stashbase-docx-conversion: complete -->'
          : 'prepared document\n<!-- stashbase-pdf-conversion: complete -->');
      }
      const completed = fs.readFileSync(derived, 'utf8');
      assert.equal((await agentContextFile(source)).available, true);
      const read = await readProjectFile(source);
      assert.equal(read.content, completed);
      assert.equal(read.path, filesystemPath.absolute(source));
      assert.ok(read.version);
      assert.deepEqual(await readProjectFile(derived), read);
      const window = await readProjectFile(derived, { offset: 1, limit: 1 });
      assert.equal(window.partial, true);
      assert.equal(window.version, undefined);

      const unavailable = async () => {
        assert.equal((await agentContextFile(source)).available, false);
        for (const target of [source, derived]) {
          await assert.rejects(readProjectFile(target), { status: 409, code: 'CONVERSION_NOT_READY' });
        }
      };
      fs.writeFileSync(derived, 'partial output');
      await unavailable();
      fs.writeFileSync(derived, completed);
      for (const fail of [() => markCancelled(source), () => markFailed(source, 'failed extraction')]) {
        fail();
        await unavailable();
        clearRecord(source);
      }
      if (format === 'audio') {
        const transcript = derivedTranscriptFor(source);
        const json = fs.readFileSync(transcript);
        fs.writeFileSync(transcript, '{"schemaVersion":1}');
        await unavailable();
        fs.writeFileSync(transcript, json);
      }
      assert.equal((await agentContextFile(source)).available, true);
      const future = new Date(Date.now() + 10_000);
      fs.utimesSync(source, future, future);
      await unavailable();
      fs.unlinkSync(source);
      await assert.rejects(agentContextFile(source), { status: 404 });
      for (const target of [source, derived]) await assert.rejects(readProjectFile(target), { status: 404 });
    });
  }
});

test('legacy derived reads retain project scope, source containment, and the bounded-read limit', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-prepared-scope-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = path.join(root, 'project');
  const other = path.join(root, 'other');
  fs.mkdirSync(project); fs.mkdirSync(other);
  await registerProjectFolderAsync(project);
  await registerProjectFolderAsync(other);
  const source = path.join(project, 'document.pdf');
  fs.writeFileSync(source, 'source');
  registerDerivedSource(source);
  const derived = derivedNoteFor(source);
  fs.mkdirSync(path.dirname(derived), { recursive: true });
  fs.writeFileSync(derived, 'prepared\n<!-- stashbase-pdf-conversion: complete -->');
  registerAttributedAgentSession('other-project', {
    agentId: 'claude', windowId: 'scope', boundFolder: () => other,
    isUnbound: () => false, turnInFlight: () => true, nativeSessionId: () => null, rebindToFolder: () => false,
  });
  t.after(() => unregisterAttributedAgentSession('other-project'));
  await assert.rejects(withAgentProjectScope('other-project', () => readProjectFile(derived)), { code: 'PROJECT_SCOPE_MISMATCH' });
  fs.truncateSync(derived, 8 * 1024 * 1024 + 1);
  await assert.rejects(readProjectFile(derived, { limit: 1 }), { code: 'FILE_TOO_LARGE' });
  fs.unlinkSync(source);
  const outside = path.join(root, 'outside.pdf');
  fs.writeFileSync(outside, 'outside');
  fs.symlinkSync(outside, source);
  await assert.rejects(readProjectFile(derived), { status: 404 });
});
