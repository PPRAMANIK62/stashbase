#!/usr/bin/env node
// Renderer file-size gate. A source file over the limit needs an entry in
// the allowlist below, and the allowlist only ever shrinks: an entry whose
// file has come back under the limit is itself a failure, so the ceiling
// follows the code down.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const LIMIT = 400;
/** Tests are measured too: a suite past this is two suites. */
export const TEST_LIMIT = 500;
// Empty: every authored renderer file is under the limit. An entry here is a
// standing exception, and the list only ever shrinks — an allowlisted file
// that has come back under the limit fails until its entry is removed.
const defaultAllowlist = new Map();

function files(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return files(absolute);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.stories\.tsx?$/.test(entry.name)
      ? [absolute]
      : [];
  });
}

export function findRendererSizeViolations(root = repositoryRoot, allowlist = defaultAllowlist) {
  const sourceRoot = path.join(root, 'renderer/src');
  const violations = [];
  const seen = new Set();
  for (const file of files(sourceRoot)) {
    const relative = path.relative(sourceRoot, file).split(path.sep).join('/');
    const lines = fs.readFileSync(file, 'utf8').split('\n').length;
    const limit = /\.test\.tsx?$/.test(relative) ? TEST_LIMIT : LIMIT;
    const ceiling = allowlist.get(relative);
    if (ceiling !== undefined) {
      seen.add(relative);
      if (lines <= limit) violations.push(`${relative}: ${lines} lines, remove its allowlist entry`);
      else if (lines > ceiling)
        violations.push(`${relative}: ${lines} lines, over its ceiling of ${ceiling}`);
    } else if (lines > limit) {
      violations.push(`${relative}: ${lines} lines, over the ${limit}-line limit`);
    }
  }
  for (const relative of allowlist.keys()) {
    if (!seen.has(relative)) violations.push(`${relative}: allowlisted but missing`);
  }
  return violations.sort();
}

export function checkSizes(root = repositoryRoot, allowlist = defaultAllowlist) {
  const violations = findRendererSizeViolations(root, allowlist);
  if (violations.length === 0) return;
  throw new Error(`Renderer size violations:\n${violations.join('\n')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const violations = findRendererSizeViolations();
  if (violations.length) {
    console.error(`[renderer size] ${violations.length} violation(s):`);
    for (const violation of violations) console.error(`  ${violation}`);
    process.exit(1);
  }
  console.log('renderer size check passed');
}
