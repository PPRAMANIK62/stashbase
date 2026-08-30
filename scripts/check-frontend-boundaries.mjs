#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceExtensions = new Set(['.css', '.html', '.js', '.jsx', '.json', '.mjs', '.ts', '.tsx']);
const skippedDirectories = new Set(['dist', 'node_modules']);

function sourceFiles(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.') || skippedDirectories.has(entry.name)) return [];
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return entry.isFile() && sourceExtensions.has(path.extname(entry.name)) ? [absolute] : [];
  });
}

export function findFrontendBoundaryViolations(root = repositoryRoot) {
  const checks = [
    { directory: 'web-next', forbidden: 'web-src' },
  ];

  return checks.flatMap(({ directory, forbidden }) => (
    sourceFiles(path.join(root, directory)).flatMap((absolute) => {
      const source = fs.readFileSync(absolute, 'utf8');
      if (!source.includes(forbidden)) return [];
      return [`${path.relative(root, absolute)} references ${forbidden}`];
    })
  ));
}

export function checkFrontendBoundaries(root = repositoryRoot) {
  const violations = findFrontendBoundaryViolations(root);
  if (violations.length === 0) return;
  throw new Error(`Frontend implementations must remain isolated:\n${violations.join('\n')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkFrontendBoundaries();
  console.log('frontend boundary check passed');
}
