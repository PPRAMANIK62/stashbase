'use strict';

console.log("Redaction")

const REDACTED = '[REDACTED]';

const SECRET_FIELD = String.raw`(?:[A-Z0-9]+[_-])?(?:API[_-]?KEY|ACCESS[_-]?TOKEN|REFRESH[_-]?TOKEN|CLIENT[_-]?SECRET|SECRET|PASSWORD|AUTHORIZATION|COOKIE|TOKEN|AWS[_-]?SECRET[_-]?ACCESS[_-]?KEY|AWS[_-]?ACCESS[_-]?KEY[_-]?ID|AWS[_-]?SESSION[_-]?TOKEN|GITHUB[_-]?TOKEN)`;
const SECRET_VALUE = String.raw`(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,}\]\r\n]+)`;

function replaceCounted(text, expression, replacement, counts, kind) {
  return text.replace(expression, (...args) => {
    counts[kind] = (counts[kind] ?? 0) + 1;
    return typeof replacement === 'function' ? replacement(...args) : replacement;
  });
}

function replaceHomePaths(text, counts) {
  let next = replaceCounted(
    text,
    /\b[A-Za-z]:\\Users\\[^\\/\r\n\s]+/g,
    '~',
    counts,
    'homePath',
  );
  next = replaceCounted(next, /\/Users\/[^/\r\n\s]+/g, '~', counts, 'homePath');
  return replaceCounted(next, /\/home\/[^/\r\n\s]+/g, '~', counts, 'homePath');
}

/**
 * Deterministic, dependency-free log redaction. It returns only redacted text
 * and aggregate category counts; matched values are never retained or exposed.
 */
function redactBugReportText(input) {
  let text = typeof input === 'string' ? input : String(input ?? '');
  const counts = Object.create(null);

  // PEM blocks must be removed as one unit before line-oriented rules can
  // expose an interior base64 line.
  text = replaceCounted(
    text,
    /-----BEGIN(?: [A-Z0-9]+)* PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z0-9]+)* PRIVATE KEY-----/gi,
    REDACTED,
    counts,
    'privateKey',
  );

  // HTTP header folding permits continuation lines beginning with whitespace.
  // Redact the complete logical header rather than trying to retain a scheme.
  text = replaceCounted(
    text,
    /(^|\n)([ \t]*(?:(?:proxy-)?authorization|cookie|set-cookie)\s*:\s*)[^\r\n]*(?:\r?\n[ \t]+[^\r\n]*)*/gim,
    (_match, prefix, header) => `${prefix}${header}${REDACTED}`,
    counts,
    'header',
  );

  // YAML block values can otherwise leave their indented secret continuation
  // visible after the field name is masked.
  const multilineField = new RegExp(
    String.raw`(^|\n)([ \t]*["']?${SECRET_FIELD}["']?\s*:\s*(?:[>|][-+]?)?\s*\r?\n)(?:[ \t]+[^\r\n]*(?:\r?\n|$))+`,
    'gim',
  );
  text = replaceCounted(
    text,
    multilineField,
    (_match, prefix, field) => `${prefix}${field}${REDACTED}\n`,
    counts,
    'secretField',
  );

  const namedField = new RegExp(
    String.raw`(^|[\n\r{,;&\s])(["']?${SECRET_FIELD}["']?\s*[:=]\s*)${SECRET_VALUE}`,
    'gim',
  );
  text = replaceCounted(
    text,
    namedField,
    (_match, prefix, field) => `${prefix}${field}${REDACTED}`,
    counts,
    'secretField',
  );

  text = replaceCounted(
    text,
    /([?&](?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|secret|password|token)=)[^&#\s]+/gi,
    `$1${REDACTED}`,
    counts,
    'queryValue',
  );
  text = replaceCounted(text, /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, `Bearer ${REDACTED}`, counts, 'bearer');
  text = replaceCounted(text, /\bBasic\s+[A-Za-z0-9+/=]{8,}/gi, `Basic ${REDACTED}`, counts, 'basic');
  text = replaceCounted(text, /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, REDACTED, counts, 'githubToken');
  text = replaceCounted(text, /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g, REDACTED, counts, 'openAiKey');
  text = replaceCounted(text, /\bsk-ant-[A-Za-z0-9_-]{16,}\b/g, REDACTED, counts, 'anthropicKey');
  text = replaceCounted(text, /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, REDACTED, counts, 'awsCredential');

  // A tail can begin inside a folded credential or private-key block. A full
  // base64-like line is not useful report context, so fail closed on it.
  text = replaceCounted(text, /^[ \t]*[A-Za-z0-9+/]{40,}={0,2}[ \t]*$/gm, REDACTED, counts, 'opaqueBlock');
  text = replaceHomePaths(text, counts);

  const redactionCount = Object.values(counts).reduce((total, count) => total + count, 0);
  return {
    text,
    redactionCount,
  };
}

module.exports = {
  REDACTED,
  redactBugReportText,
};
