'use strict';

console.log("BUG-Report-Log");
const fs = require('node:fs');
const { redactBugReportText } = require('./bug-report-redaction.cjs');

const MAX_LOG_TAIL_BYTES = 32 * 1024;

/** Read a bounded tail without loading the rest of the application log. */
function readApplicationLogTail({
  filePath,
  maxBytes = MAX_LOG_TAIL_BYTES,
  fsModule = fs,
} = {}) {
  if (typeof filePath !== 'string' || !filePath || !Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    return null;
  }
  let fd;
  try {
    const stat = fsModule.statSync(filePath);
    if (!stat || !Number.isSafeInteger(stat.size) || stat.size <= 0) return { text: '', truncated: false, bytesRead: 0 };
    const bytesToRead = Math.min(stat.size, maxBytes);
    const start = Math.max(0, stat.size - bytesToRead);
    const buffer = Buffer.alloc(bytesToRead);
    fd = fsModule.openSync(filePath, 'r');
    const bytesRead = fsModule.readSync(fd, buffer, 0, bytesToRead, start);
    let text = buffer.subarray(0, Math.max(0, bytesRead)).toString('utf8');
    if (start > 0) {
      const firstNewline = text.search(/\r?\n/);
      text = firstNewline === -1 ? '' : text.slice(firstNewline + (text[firstNewline] === '\r' ? 2 : 1));
    }
    return { text, truncated: start > 0, bytesRead };
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try { fsModule.closeSync(fd); } catch { /* best effort */ }
    }
  }
}

function collectRedactedApplicationLog(options) {
  const tail = readApplicationLogTail(options);
  if (!tail) return null;
  const redacted = redactBugReportText(tail.text);
  return {
    text: redacted.text,
    byteLength: Buffer.byteLength(redacted.text, 'utf8'),
    truncated: tail.truncated,
    bytesRead: tail.bytesRead,
    redactionCount: redacted.redactionCount,
  };
}

module.exports = {
  MAX_LOG_TAIL_BYTES,
  collectRedactedApplicationLog,
  readApplicationLogTail,
};
