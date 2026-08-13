'use strict';

const assert = require('node:assert/strict');
const os = require('node:os');
const test = require('node:test');

const {
  REDACTED,
  prepareBugReportText,
  redactBugReportText,
  scanBugReportText,
} = require('./bug-report-redaction.cjs');

const POSIX_HOME = '/Users/Jane Doe';
const WINDOWS_HOME = 'C:\\Users\\Jane Doe';

function logRedaction(input, result, label) {
  console.log('\n' + '='.repeat(80));
  console.log('[' + label + ']');
  console.log('-'.repeat(80));

  console.log('PREVIOUS STATE:');
  console.log(String(input));

  console.log('\nCURRENT STATE AFTER REDACTION:');
  console.log(result.text);

  console.log('\nREDACTION COUNT:');
  console.log(result.redactionCount);

  console.log('='.repeat(80) + '\n');
}

function redact(input, homeDir = POSIX_HOME) {
  const result = redactBugReportText(input, { homeDir });

  logRedaction(input, result, 'REDACTION');

  return result;
}

test('defaults to the exact home directory reported by the operating system', () => {
  const homeDir = os.homedir().replace(/[\\/]+$/, '');
  const separator = homeDir.includes('\\') ? '\\' : '/';

  const input =
    homeDir + separator + 'project' + separator + 'file.md';

  const result = redactBugReportText(input);

  logRedaction(
    input,
    result,
    'OS HOME DIRECTORY'
  );

  assert.equal(
    result.text,
    '~' + separator + 'project' + separator + 'file.md'
  );

  assert.equal(result.text.includes(homeDir), false);
});

test('redacts MCP bearer tokens with and without a product prefix', () => {
  const input = [
    'MCP_BEARER_TOKEN=first-secret',
    'STASHBASE_MCP_BEARER_TOKEN=second-secret',
  ].join('\n');

  const result = redact(input);

  assert.equal(
    result.text,
    [
      'MCP_BEARER_TOKEN=' + REDACTED,
      'STASHBASE_MCP_BEARER_TOKEN=' + REDACTED,
    ].join('\n')
  );

  assert.equal(result.redactionCount, 2);
});

test('uses the exact POSIX home directory and preserves a spaced username', () => {
  const input = '/Users/Jane Doe/project/file.md';

  const result = redact(input);

  assert.equal(result.text, '~/project/file.md');
  assert.equal(result.text.includes('Doe'), false);
});

test('uses the exact Windows home directory with Windows or POSIX separators', () => {
  const windowsInput =
    'C:\\Users\\Jane Doe\\project\\file.md';

  const windowsResult = redactBugReportText(
    windowsInput,
    { homeDir: WINDOWS_HOME }
  );

  logRedaction(
    windowsInput,
    windowsResult,
    'WINDOWS HOME - WINDOWS SEPARATORS'
  );

  assert.equal(
    windowsResult.text,
    '~\\project\\file.md'
  );

  const posixInput =
    'C:/Users/Jane Doe/project/file.md';

  const posixResult = redactBugReportText(
    posixInput,
    { homeDir: WINDOWS_HOME }
  );

  logRedaction(
    posixInput,
    posixResult,
    'WINDOWS HOME - POSIX SEPARATORS'
  );

  assert.equal(
    posixResult.text,
    '~/project/file.md'
  );
});

test('does not guess or partially replace a different home directory', () => {
  const input =
    '/Users/Jan/project /Users/Jane Doe/project';

  const result = redact(
    input,
    '/Users/Jane'
  );

  assert.equal(
    result.text,
    '/Users/Jan/project /Users/Jane Doe/project'
  );
});

test('redacts camelCase, kebab-case, snake_case, and multi-part fields', () => {
  const input = [
    'mcpBearerToken=camel-secret',
    'mcp-bearer-token=kebab-secret',
    'stashbase_mcp_bearer_token=snake-secret',
    'companyProductionClientSecret=multi-secret',
  ].join('\n');

  const result = redact(input);

  assert.equal(
    result.text,
    [
      'mcpBearerToken=' + REDACTED,
      'mcp-bearer-token=' + REDACTED,
      'stashbase_mcp_bearer_token=' + REDACTED,
      'companyProductionClientSecret=' + REDACTED,
    ].join('\n')
  );
});

test('redacts JSON fields while preserving valid JSON', () => {
  const input = JSON.stringify({
    MCP_BEARER_TOKEN: 'mcp-secret',
    STASHBASE_MCP_BEARER_TOKEN: 'prefixed-mcp-secret',
    mcpBearerToken: 'camel-secret',
    'service-access-token': 'kebab-secret',
    nested: {
      api_key: 'api-secret',
      ordinary: 'safe',
    },
  });

  const result = redact(input);

  const parsed = JSON.parse(result.text);

  assert.equal(
    parsed.MCP_BEARER_TOKEN,
    REDACTED
  );

  assert.equal(
    parsed.STASHBASE_MCP_BEARER_TOKEN,
    REDACTED
  );

  assert.equal(
    parsed.mcpBearerToken,
    REDACTED
  );

  assert.equal(
    parsed['service-access-token'],
    REDACTED
  );

  assert.equal(
    parsed.nested.api_key,
    REDACTED
  );

  assert.equal(
    parsed.nested.ordinary,
    'safe'
  );
});

test('does not treat unrelated names containing secret-like substrings as fields', () => {
  const input = [
    'tokenizerMode=standard',
    'secretaryName=Alex',
    'passwordlessMode=enabled',
    'credentialingStatus=complete',
  ].join('\n');

  const result = redact(input);

  assert.deepEqual(
    result,
    {
      text: input,
      redactionCount: 0,
    }
  );
});

test('does not replace a separator-normalized home inside another rooted path', () => {
  const input =
    'C:\\Users\\Jane Doe\\project\\file.md';

  const result = redact(
    input,
    POSIX_HOME
  );

  assert.equal(result.text, input);
  assert.equal(result.redactionCount, 0);
});

test('redacts secrets embedded in normal log lines and multiple values per input', () => {
  const input =
    '2026-08-06 INFO request failed MCP_BEARER_TOKEN=one; authToken=two, password=three retrying';

  const result = redact(input);

  assert.equal(
    result.text.includes('one'),
    false
  );

  assert.equal(
    result.text.includes('two'),
    false
  );

  assert.equal(
    result.text.includes('three'),
    false
  );

  assert.equal(
    result.redactionCount,
    3
  );
});

test('already-redacted values stay stable and do not inflate counts', () => {
  const input =
    'token=' + REDACTED +
    '\n{"clientSecret":"' + REDACTED + '"}';

  const result = redact(input);

  assert.equal(result.text, input);
  assert.equal(result.redactionCount, 0);

  assert.equal(
    scanBugReportText(
      result.text,
      { homeDir: POSIX_HOME }
    ).safe,
    true
  );
});

test('redacted headers and query values pass the independent scan', () => {
  const input = [
    'Authorization: Bearer header-secret-value',
    'GET https://example.test/?access_token=query-secret-value',
  ].join('\n');

  const prepared = prepareBugReportText(
    input,
    { homeDir: POSIX_HOME }
  );

  console.log('\n' + '='.repeat(80));
  console.log('[PREPARE BUG REPORT]');
  console.log('-'.repeat(80));

  console.log('PREVIOUS STATE:');
  console.log(input);

  console.log('\nCURRENT STATE AFTER REDACTION:');
  console.log(prepared.text);

  console.log('\nPREPARATION RESULT:');
  console.dir(prepared, { depth: null });

  console.log('='.repeat(80) + '\n');

  assert.equal(prepared.ok, true);

  assert.equal(
    prepared.text,
    [
      'Authorization: ' + REDACTED,
      'GET https://example.test/?access_token=' + REDACTED,
    ].join('\n')
  );
});

test('redacts realistic structured diagnostics and log data without mutating the source object', () => {
  const source = {
    level: 'error',
    message:
      'request failed MCP_BEARER_TOKEN=log-secret',
    context: {
      appVersion: '1.3.2',
      platform: 'darwin',
      sourcePath:
        '/Users/Jane Doe/project/file.md',
      githubToken:
        'ghp_abcdefghijklmnopqrstuvwxyz123456',
    },
  };

  const serialized = JSON.stringify(source);

  const result = redact(serialized);

  const parsed = JSON.parse(result.text);

  assert.equal(
    source.context.sourcePath,
    '/Users/Jane Doe/project/file.md'
  );

  assert.equal(
    parsed.message.includes('log-secret'),
    false
  );

  assert.equal(
    parsed.context.sourcePath,
    '~/project/file.md'
  );

  assert.equal(
    parsed.context.githubToken,
    REDACTED
  );

  assert.equal(
    scanBugReportText(
      result.text,
      { homeDir: POSIX_HOME }
    ).safe,
    true
  );
});

test('fail-closed preparation rejects suspicious content left by an incomplete redactor', () => {
  const input =
    'unsafe MCP_BEARER_TOKEN=still-secret';

  const result = prepareBugReportText(
    input,
    {
      homeDir: POSIX_HOME,
      redact: (value) => ({
        text: String(value),
        redactionCount: 0,
      }),
    }
  );

  console.log('\n' + '='.repeat(80));
  console.log('[FAIL-CLOSED PREPARATION - REJECTED]');
  console.log('-'.repeat(80));

  console.log('PREVIOUS STATE:');
  console.log(input);

  console.log('\nCURRENT STATE AFTER REDACTION:');
  console.log(
    result.text === undefined
      ? '(no text returned)'
      : result.text
  );

  console.log('\nPREPARATION RESULT:');
  console.dir(result, { depth: null });

  console.log('='.repeat(80) + '\n');

  assert.deepEqual(
    result,
    {
      ok: false,
      redactionCount: 0,
      findingCount: 1,
    }
  );
});

test('fail-closed preparation allows content that scans clean after redaction', () => {
  const input = 'token=secret';

  const result = prepareBugReportText(
    input,
    { homeDir: POSIX_HOME }
  );

  console.log('\n' + '='.repeat(80));
  console.log('[FAIL-CLOSED PREPARATION - ACCEPTED]');
  console.log('-'.repeat(80));

  console.log('PREVIOUS STATE:');
  console.log(input);

  console.log('\nCURRENT STATE AFTER REDACTION:');
  console.log(result.text);

  console.log('\nPREPARATION RESULT:');
  console.dir(result, { depth: null });

  console.log('='.repeat(80) + '\n');

  assert.deepEqual(
    result,
    {
      ok: true,
      text: 'token=' + REDACTED,
      redactionCount: 1,
    }
  );
});