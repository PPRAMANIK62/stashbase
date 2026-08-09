'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  REDACTED,
  prepareBugReportText,
  redactBugReportText,
  scanBugReportText,
} = require('./bug-report-redaction.cjs');

const POSIX_HOME = '/Users/Jane Doe';
const WINDOWS_HOME = 'C:\\Users\\Jane Doe';

function redact(input, homeDir = POSIX_HOME) {
  return redactBugReportText(input, { homeDir });
}

test('redacts MCP bearer tokens with and without a product prefix', () => {
  const result = redact([
    'MCP_BEARER_TOKEN=first-secret',
    'STASHBASE_MCP_BEARER_TOKEN=second-secret',
  ].join('\n'));

  assert.equal(result.text, [
    `MCP_BEARER_TOKEN=${REDACTED}`,
    `STASHBASE_MCP_BEARER_TOKEN=${REDACTED}`,
  ].join('\n'));
  assert.equal(result.redactionCount, 2);
});

test('uses the exact POSIX home directory and preserves a spaced username', () => {
  const result = redact('/Users/Jane Doe/project/file.md');
  assert.equal(result.text, '~/project/file.md');
  assert.equal(result.text.includes('Doe'), false);
});

test('uses the exact Windows home directory with Windows or POSIX separators', () => {
  assert.equal(
    redactBugReportText('C:\\Users\\Jane Doe\\project\\file.md', { homeDir: WINDOWS_HOME }).text,
    '~\\project\\file.md',
  );
  assert.equal(
    redactBugReportText('C:/Users/Jane Doe/project/file.md', { homeDir: WINDOWS_HOME }).text,
    '~/project/file.md',
  );
});

test('does not guess or partially replace a different home directory', () => {
  const result = redact('/Users/Jan/project /Users/Jane Doe/project', '/Users/Jane');
  assert.equal(result.text, '/Users/Jan/project /Users/Jane Doe/project');
});

test('redacts camelCase, kebab-case, snake_case, and multi-part fields', () => {
  const result = redact([
    'mcpBearerToken=camel-secret',
    'mcp-bearer-token=kebab-secret',
    'stashbase_mcp_bearer_token=snake-secret',
    'companyProductionClientSecret=multi-secret',
  ].join('\n'));

  assert.equal(result.text, [
    `mcpBearerToken=${REDACTED}`,
    `mcp-bearer-token=${REDACTED}`,
    `stashbase_mcp_bearer_token=${REDACTED}`,
    `companyProductionClientSecret=${REDACTED}`,
  ].join('\n'));
});

test('redacts JSON fields while preserving valid JSON', () => {
  const input = JSON.stringify({
    mcpBearerToken: 'camel-secret',
    'service-access-token': 'kebab-secret',
    nested: { api_key: 'api-secret', ordinary: 'safe' },
  });
  const result = redact(input);
  const parsed = JSON.parse(result.text);

  assert.equal(parsed.mcpBearerToken, REDACTED);
  assert.equal(parsed['service-access-token'], REDACTED);
  assert.equal(parsed.nested.api_key, REDACTED);
  assert.equal(parsed.nested.ordinary, 'safe');
});

test('redacts secrets embedded in normal log lines and multiple values per input', () => {
  const result = redact(
    '2026-08-06 INFO request failed MCP_BEARER_TOKEN=one; authToken=two, password=three retrying',
  );

  assert.equal(result.text.includes('one'), false);
  assert.equal(result.text.includes('two'), false);
  assert.equal(result.text.includes('three'), false);
  assert.equal(result.redactionCount, 3);
});

test('already-redacted values stay stable and do not inflate counts', () => {
  const input = `token=${REDACTED}\n{"clientSecret":"${REDACTED}"}`;
  const result = redact(input);
  assert.equal(result.text, input);
  assert.equal(result.redactionCount, 0);
  assert.equal(scanBugReportText(result.text, { homeDir: POSIX_HOME }).safe, true);
});

test('redacted headers and query values pass the independent scan', () => {
  const input = [
    'Authorization: Bearer header-secret-value',
    'GET https://example.test/?access_token=query-secret-value',
  ].join('\n');
  const prepared = prepareBugReportText(input, { homeDir: POSIX_HOME });

  assert.equal(prepared.ok, true);
  assert.equal(prepared.text, [
    `Authorization: ${REDACTED}`,
    `GET https://example.test/?access_token=${REDACTED}`,
  ].join('\n'));
});

test('redacts realistic structured diagnostics and log data without mutating the source object', () => {
  const source = {
    level: 'error',
    message: 'request failed MCP_BEARER_TOKEN=log-secret',
    context: {
      appVersion: '1.3.2',
      platform: 'darwin',
      sourcePath: '/Users/Jane Doe/project/file.md',
      githubToken: 'ghp_abcdefghijklmnopqrstuvwxyz123456',
    },
  };
  const serialized = JSON.stringify(source);
  const result = redact(serialized);
  const parsed = JSON.parse(result.text);

  assert.equal(source.context.sourcePath, '/Users/Jane Doe/project/file.md');
  assert.equal(parsed.message.includes('log-secret'), false);
  assert.equal(parsed.context.sourcePath, '~/project/file.md');
  assert.equal(parsed.context.githubToken, REDACTED);
  assert.equal(scanBugReportText(result.text, { homeDir: POSIX_HOME }).safe, true);
});

test('fail-closed preparation rejects suspicious content left by an incomplete redactor', () => {
  const input = 'unsafe MCP_BEARER_TOKEN=still-secret';
  const result = prepareBugReportText(input, {
    homeDir: POSIX_HOME,
    redact: (value) => ({ text: String(value), redactionCount: 0 }),
  });

  assert.deepEqual(result, {
    ok: false,
    redactionCount: 0,
    findingCount: 1,
  });
});

test('fail-closed preparation allows content that scans clean after redaction', () => {
  const result = prepareBugReportText('token=secret', { homeDir: POSIX_HOME });
  assert.deepEqual(result, {
    ok: true,
    text: `token=${REDACTED}`,
    redactionCount: 1,
  });
});
