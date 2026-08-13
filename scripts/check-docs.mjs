import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const markdownRoots = [
  'README.md',
  'AGENTS.md',
  'CONTEXT.md',
  'CONTRIBUTING.md',
  'design-docs',
  'code-review',
  'docs',
  'release-checklists',
];
const failures = [];

function markdownFiles(entry) {
  const absolute = path.join(repoRoot, entry);
  if (!fs.existsSync(absolute)) return [];
  if (fs.statSync(absolute).isFile()) return absolute.endsWith('.md') ? [absolute] : [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((child) =>
    markdownFiles(path.relative(repoRoot, path.join(absolute, child.name))));
}

function headingAnchor(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[\p{P}\p{S}]/gu, (character) => character === '-' || character === '_' ? character : '')
    .replace(/\s/g, '-');
}

const files = [...new Set(markdownRoots.flatMap(markdownFiles))];
const contents = new Map(files.map((file) => [file, fs.readFileSync(file, 'utf8')]));
const anchors = new Map(files.map((file) => {
  const found = new Set();
  for (const match of contents.get(file).matchAll(/^#{1,6}\s+(.+)$/gm)) {
    found.add(headingAnchor(match[1].replace(/\s+#+\s*$/, '')));
  }
  return [file, found];
}));

for (const [source, markdown] of contents) {
  for (const match of markdown.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, '');
    if (!rawTarget || /^(?:https?:|mailto:)/i.test(rawTarget)) continue;
    const [rawPath, rawAnchor] = rawTarget.split('#', 2);
    const target = rawPath ? path.resolve(path.dirname(source), decodeURIComponent(rawPath)) : source;
    if (!fs.existsSync(target)) {
      failures.push(`${path.relative(repoRoot, source)}: missing link target ${rawTarget}`);
      continue;
    }
    if (rawAnchor && target.endsWith('.md')) {
      const expected = decodeURIComponent(rawAnchor).toLowerCase();
      if (!anchors.get(target)?.has(expected)) {
        failures.push(`${path.relative(repoRoot, source)}: missing anchor #${rawAnchor} in ${path.relative(repoRoot, target)}`);
      }
    }
  }

  for (const match of markdown.matchAll(/`((?:\.github|code-review|design-docs|docs|e2e|electron|mcp|python|release-checklists|scripts|server|shared|web-src)\/[^`]+)`/g)) {
    const referencedPath = match[1];
    if (/[*{]|→/.test(referencedPath) || referencedPath.startsWith('/')) continue;
    const candidate = path.join(repoRoot, referencedPath);
    if (!fs.existsSync(candidate)) {
      failures.push(`${path.relative(repoRoot, source)}: missing referenced path ${referencedPath}`);
    }
  }
}

const forbidden = [
  'design-docs/use-cases.md',
  'design-docs/design/library.md',
  'design-docs/design/markdown.md',
  'code-review/data-layer.md',
];
for (const [file, markdown] of contents) {
  for (const legacy of forbidden) {
    if (markdown.includes(legacy)) failures.push(`${path.relative(repoRoot, file)}: references retired path ${legacy}`);
  }
}

const focusedContracts = [
  'architecture.md',
  'window-lifecycle.md',
  'renderer-workspace.md',
  'data-lifecycle.md',
  'file-transactions.md',
  'document-viewers.md',
  'markdown-rendering.md',
  'settings-config.md',
  'mcp-access.md',
  'agent-runtime.md',
  'agent-panel.md',
  'renderer-styling.md',
  'ui-regression-testing.md',
  'release-pipeline.md',
];
for (const name of focusedContracts) {
  const markdown = fs.readFileSync(path.join(repoRoot, 'code-review', name), 'utf8');
  if (!/^## Implementation Map$/m.test(markdown)) failures.push(`code-review/${name}: missing Implementation Map`);
  if (!/^## (?:.* )?Validation(?: .*)?$/im.test(markdown)) failures.push(`code-review/${name}: missing Validation section`);
}

const journeyDoc = fs.readFileSync(path.join(repoRoot, 'design-docs/user-journeys.md'), 'utf8');
const coverageDoc = fs.readFileSync(path.join(repoRoot, 'code-review/journey-coverage.md'), 'utf8');
for (let number = 1; number <= 8; number += 1) {
  const id = `J${String(number).padStart(2, '0')}`;
  const headingCount = [...journeyDoc.matchAll(new RegExp(`^## ${id}:`, 'gm'))].length;
  if (headingCount !== 1) failures.push(`design-docs/user-journeys.md: expected one ${id} heading, found ${headingCount}`);
  if (!coverageDoc.includes(`| [${id} `)) failures.push(`code-review/journey-coverage.md: missing ${id} evidence row`);
}

if (failures.length > 0) {
  console.error(`[docs] ${failures.length} validation failure(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`[docs] verified ${files.length} Markdown files, local links, contract shape, and J01-J08 coverage`);
}
