'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { collectBugReportDiagnostics } = require('./bug-report-diagnostics.cjs');
const {
  collectRedactedApplicationLog,
  readApplicationLogTail,
} = require('./bug-report-log.cjs');
const {
  MAX_SCREENSHOT_BYTES,
  captureWindowScreenshot,
} = require('./bug-report-screenshot.cjs');

function fakeFs(text) {
  const bytes = Buffer.from(text, 'utf8');
  return {
    statSync: () => ({ size: bytes.length }),
    openSync: () => 9,
    readSync: (_fd, buffer, offset, length, position) => {
      bytes.copy(buffer, offset, position, position + length);
      return Math.min(length, bytes.length - position);
    },
    closeSync: () => {},
  };
}

test('bounded log collection reads only the tail and starts at a complete line', () => {
  const input = 'old-sensitive-line\nrecent-one\nrecent-two\n';
  const maxBytes = Buffer.byteLength('e\nrecent-one\nrecent-two\n');
  const tail = readApplicationLogTail({ filePath: '/logs/server.log', maxBytes, fsModule: fakeFs(input) });

  assert.deepEqual(tail, {
    text: 'recent-one\nrecent-two\n',
    truncated: true,
    bytesRead: maxBytes,
  });
  assert.equal(tail.text.includes('old-sensitive-line'), false);
});

test('log preparation redacts before returning a bounded report excerpt', () => {
  const input = 'INFO MCP_BEARER_TOKEN=secret\nINFO done\n';
  const result = collectRedactedApplicationLog({
    filePath: '/logs/server.log',
    fsModule: fakeFs(input),
    homeDir: '/Users/Jane Doe',
  });

  assert.equal(result.text, 'INFO MCP_BEARER_TOKEN=[REDACTED]\nINFO done\n');
  assert.equal(result.redactionCount, 1);
  assert.equal(result.truncated, false);
});

test('log preparation excludes internal runtime paths before report content crosses the review boundary', () => {
  const input = [
    'server entry: /Volumes/private-checkout/stashbase/server/index.ts',
    'server cwd: /Volumes/private-checkout/stashbase',
    'resources: C:\\Users\\Jane\\AppData\\Local\\StashBase\\resources',
    'INFO server ready',
  ].join('\n');
  const result = collectRedactedApplicationLog({
    filePath: '/logs/server.log',
    fsModule: fakeFs(input),
    homeDir: '/Users/Jane Doe',
  });

  assert.equal(result.text, 'INFO server ready');
  assert.equal(result.text.includes('/Volumes/private-checkout'), false);
  assert.equal(result.text.includes('C:\\Users\\Jane'), false);
});

test('log preparation rejects output when the second scan remains suspicious', () => {
  const input = 'INFO MCP_BEARER_TOKEN=still-secret\n';
  const result = collectRedactedApplicationLog({
    filePath: '/logs/server.log',
    fsModule: fakeFs(input),
    homeDir: '/Users/Jane Doe',
    redact: (value) => ({ text: String(value), redactionCount: 0 }),
  });

  assert.equal(result, null);
});

test('diagnostics are fixed to the privacy-reviewed allowlist and frozen', () => {
  const diagnostics = collectBugReportDiagnostics({
    app: {
      getName: () => 'StashBase',
      getVersion: () => '1.3.2',
      isPackaged: true,
    },
    platform: () => 'win32',
    release: () => '10.0.26100',
    arch: () => 'x64',
    electronVersion: '39.8.8',
    now: () => new Date('2026-08-06T12:00:00.000Z'),
  });

  assert.deepEqual(diagnostics, {
    schemaVersion: 1,
    capturedAt: '2026-08-06T12:00:00.000Z',
    app: {
      name: 'StashBase',
      version: '1.3.2',
      packaged: true,
      electronVersion: '39.8.8',
    },
    os: {
      platform: 'win32',
      release: '10.0.26100',
      arch: 'x64',
    },
  });
  assert.equal(Object.isFrozen(diagnostics), true);
  assert.equal(Object.isFrozen(diagnostics.app), true);
  assert.equal('hostname' in diagnostics.os, false);
  assert.equal('environment' in diagnostics, false);
});

test('screenshot capture retains one bounded lossless PNG with its exact dimensions', async () => {
  const original = Buffer.from('png-bytes');
  let captures = 0;
  const result = await captureWindowScreenshot({
    capturePage: async () => {
      captures += 1;
      return {
        toPNG: () => original,
        getSize: () => ({ width: 1440, height: 900 }),
      };
    },
  });

  original.fill(0);
  assert.equal(captures, 1);
  assert.equal(result.mimeType, 'image/png');
  assert.equal(result.bytes.toString(), 'png-bytes');
  assert.equal(result.width, 1440);
  assert.equal(result.height, 900);
  assert.equal('preview' in result, false);
  assert.equal('path' in result, false);
});

test('oversized screenshots are unavailable instead of crossing the review bound', async () => {
  const result = await captureWindowScreenshot({
    capturePage: async () => ({
      toPNG: () => Buffer.alloc(MAX_SCREENSHOT_BYTES + 1),
      getSize: () => ({ width: 1440, height: 900 }),
    }),
  });

  assert.equal(result, null);
});

test('bug-report collection code never prints collected content', () => {
  const files = [
    'bug-report-diagnostics.cjs',
    'bug-report-log.cjs',
    'bug-report-redaction.cjs',
    'bug-report-screenshot.cjs',
    'bug-report-service.cjs',
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.doesNotMatch(source, /\bconsole\.(?:debug|dir|error|info|log|trace|warn)\s*\(/);
  }
});

test('unavailable screenshot capture returns no artifact', async () => {
  assert.equal(await captureWindowScreenshot(null), null);
  assert.equal(await captureWindowScreenshot({ capturePage: async () => null }), null);
});
