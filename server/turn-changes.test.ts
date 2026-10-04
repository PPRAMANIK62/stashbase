import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { agentServerEventSchema } from '../shared/protocols/websocket/agent-session.ts';
import { filesystemPath } from './filesystem-path.ts';
import { textVersion } from './text-file-transaction.ts';
import {
  beginTurnBaseline,
  finishTurn,
  forgetFolderTurnChanges,
  trackAgentTurns,
  turnChangeBefore,
} from './turn-changes.ts';

function tempFolder(t: test.TestContext): string {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-turn-changes-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  return folder.replace(/\\/g, '/');
}

function write(folder: string, rel: string, content: string): string {
  const abs = path.join(folder, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  return filesystemPath.join(folder, rel);
}

test('a turn records the Markdown it created, edited and deleted, however it was written', async (t) => {
  const folder = tempFolder(t);
  const edited = write(folder, 'Drafts/Essay.md', '# Essay\n\nFirst.\nSecond.\n');
  const deleted = write(folder, 'Old.md', 'gone\n');
  write(folder, 'notes.txt', 'plain\n');
  write(folder, 'Drafts/.Paper.pdf.md', 'derived\n');
  write(folder, 'Huge.md', 'x'.repeat(1024 * 1024 + 1));

  const baseline = await beginTurnBaseline(folder);
  // Plain writes, the way a shell command changes files: no tool names them.
  fs.writeFileSync(edited, '# Essay\n\nFirst, revised.\nSecond.\nThird.\n');
  fs.rmSync(deleted);
  const created = write(folder, 'New.md', 'fresh\n');
  write(folder, 'notes.txt', 'changed\n');
  write(folder, 'Drafts/.Paper.pdf.md', 'derived, changed\n');
  write(folder, 'Huge.md', 'y'.repeat(1024 * 1024 + 1));

  const turn = await finishTurn(baseline);
  assert.ok(turn);
  assert.deepEqual(turn.files, [
    { path: edited, change: 'edited', additions: 2, deletions: 1 },
    { path: created, change: 'created', additions: 1, deletions: 0 },
    { path: deleted, change: 'deleted', additions: 0, deletions: 1 },
  ].sort((a, b) => (a.path < b.path ? -1 : 1)), 'text files, hidden derived notes and oversized files are not reviewable');

  assert.deepEqual(turnChangeBefore(folder, turn.turnId, edited), {
    change: 'edited',
    before: '# Essay\n\nFirst.\nSecond.\n',
    afterVersion: textVersion(fs.readFileSync(edited)),
  });
  assert.equal(turnChangeBefore(folder, turn.turnId, created)?.before, '');
  assert.equal(turnChangeBefore(folder, turn.turnId, deleted), null, 'a deleted file has nothing to open');
  assert.deepEqual(
    turnChangeBefore(folder, turn.turnId, edited),
    turnChangeBefore(folder, turn.turnId, edited),
    'reading does not consume the record',
  );
  assert.equal(turnChangeBefore(path.join(folder, 'Drafts'), turn.turnId, edited), null, 'a turn answers only its own folder');
});

test('a turn that changed nothing records nothing, even right after a same-size rewrite', async (t) => {
  const folder = tempFolder(t);
  const file = write(folder, 'Note.md', 'aaaa\n');
  assert.equal(await finishTurn(await beginTurnBaseline(folder)), null);

  // Same size and, as a coarse filesystem would store it, the same mtime: only
  // the content tells the two apart, so a fresh file must not be trusted from
  // cache.
  const second = Math.floor(Date.now() / 1000);
  fs.utimesSync(file, second, second);
  const baseline = await beginTurnBaseline(folder);
  fs.writeFileSync(file, 'bbbb\n');
  fs.utimesSync(file, second, second);
  const turn = await finishTurn(baseline);
  assert.deepEqual(turn?.files.map((entry) => entry.change), ['edited']);
});

test('recorded turns are bounded per folder, expire, and leave with their folder', async (t) => {
  const folder = tempFolder(t);
  const nested = `${folder}/Nested`;
  const file = write(folder, 'Count.md', '0\n');
  const kept = write(folder, 'Nested/Kept.md', 'kept\n');
  const start = 1_700_000_000_000;
  const turns: string[] = [];
  for (let index = 1; index <= 21; index++) {
    const baseline = await beginTurnBaseline(folder);
    fs.writeFileSync(file, `${index}\n`);
    if (index === 21) fs.writeFileSync(kept, 'kept, edited\n');
    turns.push((await finishTurn(baseline, () => start + index))!.turnId);
  }
  const now = () => start + 100;
  assert.equal(turnChangeBefore(folder, turns[0], file, now), null, 'the oldest turn past twenty is released');
  assert.equal(turnChangeBefore(folder, turns[1], file, now)?.before, '1\n');

  forgetFolderTurnChanges(folder, [nested]);
  assert.equal(turnChangeBefore(folder, turns[20], file, now), null);
  assert.equal(turnChangeBefore(folder, turns[20], kept, now)?.before, 'kept\n', 'a retained nested project keeps its own');
  assert.equal(
    turnChangeBefore(folder, turns[20], kept, () => start + 21 + 6 * 60 * 60 * 1000),
    null,
    'an unreviewed turn expires',
  );
});

/** A socket the way `ws` presents one to an adapter: an emitter with `send`. */
function fakeSocket() {
  const ws = Object.assign(new EventEmitter(), {
    OPEN: 1,
    readyState: 1,
    sent: [] as string[],
    send(data: string) { ws.sent.push(data); },
  });
  return ws;
}

async function until<T>(read: () => T | undefined): Promise<T> {
  for (let attempt = 0; attempt < 200; attempt++) {
    const value = read();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('timed out');
}

test('a prompt reaches the runtime only after the baseline exists, and the turn reports what it changed', async (t) => {
  const folder = tempFolder(t);
  const file = write(folder, 'Draft.md', 'before the turn\n');
  const ws = fakeSocket();
  trackAgentTurns(ws as never, folder);
  const delivered: string[] = [];
  ws.on('message', (raw: Buffer | string) => {
    const text = String(raw);
    delivered.push(text);
    // The runtime acts on the prompt the moment it sees it.
    if (text.includes('"prompt"')) fs.writeFileSync(file, 'written by the agent\n');
  });

  ws.emit('message', Buffer.from(JSON.stringify({ t: 'prompt', text: 'revise' })));
  ws.emit('message', Buffer.from(JSON.stringify({ t: 'steer', id: 's', text: 'also' })));
  ws.emit('message', Buffer.from('not json'));
  assert.equal(delivered.length, 0, 'held until the capture settles');
  await until(() => (delivered.length === 3 ? true : undefined));
  assert.deepEqual(delivered.map((text) => text.slice(0, 12)), ['{"t":"prompt', '{"t":"steer"', 'not json'], 'arrival order is kept');

  ws.emit('message', Buffer.from(JSON.stringify({ t: 'interrupt' })));
  assert.equal(delivered.length, 4, 'with no capture in flight a message passes straight through');

  ws.send(JSON.stringify({ t: 'turn-start' }));
  ws.send(JSON.stringify({ t: 'turn-end', isError: false }));
  const report = agentServerEventSchema.parse(JSON.parse(await until(() => ws.sent[2])));
  assert.ok(report.t === 'turn-changes');
  assert.deepEqual(report.files, [{ path: file.replace(/\\/g, '/'), change: 'edited', additions: 1, deletions: 1 }]);
  assert.equal(turnChangeBefore(folder, report.turnId, report.files[0].path)?.before, 'before the turn\n');

  ws.emit('message', Buffer.from(JSON.stringify({ t: 'prompt', text: 'look only' })));
  await until(() => (delivered.length === 5 ? true : undefined));
  ws.send(JSON.stringify({ t: 'turn-end', isError: false }));
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(ws.sent.length, 4, 'a turn that changed nothing sends nothing');
});

test('a failed capture still delivers the prompt and leaves the turn untracked', async (t) => {
  const folder = tempFolder(t);
  write(folder, 'Draft.md', 'text\n');
  const ws = fakeSocket();
  trackAgentTurns(ws as never, folder);
  const delivered: string[] = [];
  ws.on('message', (raw: Buffer) => delivered.push(String(raw)));
  t.mock.method(filesystemPath, 'join', () => { throw new Error('scan failed'); });

  ws.emit('message', Buffer.from(JSON.stringify({ t: 'prompt', text: 'go' })));
  await until(() => (delivered.length === 1 ? true : undefined));
  ws.send(JSON.stringify({ t: 'turn-end', isError: false }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(ws.sent.length, 1);
});

test('a prompt the runtime refused does not credit the edits after it to the next turn', async (t) => {
  const folder = tempFolder(t);
  const file = write(folder, 'Draft.md', 'original\n');
  const ws = fakeSocket();
  trackAgentTurns(ws as never, folder);
  const delivered: string[] = [];
  ws.on('message', (raw: Buffer) => delivered.push(String(raw)));

  ws.emit('message', Buffer.from(JSON.stringify({ t: 'prompt', text: '' })));
  await until(() => (delivered.length === 1 ? true : undefined));
  fs.writeFileSync(file, 'the reader edited this between prompts\n');

  ws.emit('message', Buffer.from(JSON.stringify({ t: 'prompt', text: 'revise' })));
  await until(() => (delivered.length === 2 ? true : undefined));
  ws.send(JSON.stringify({ t: 'turn-start' }));
  ws.send(JSON.stringify({ t: 'turn-end', isError: false }));
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(ws.sent.length, 2, 'the refused prompt\'s baseline was replaced, so nothing changed during the turn');
});
