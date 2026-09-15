import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const packageScripts = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
).scripts ?? {};

function repositoryFiles(pathspec) {
  return execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', pathspec], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).split('\0')
    .filter(Boolean)
    .filter((file) => fs.existsSync(path.join(repoRoot, file)));
}

function headingAnchor(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[\p{P}\p{S}]/gu, (character) => character === '-' || character === '_' ? character : '')
    .replace(/\s/g, '-');
}

const repoFiles = repositoryFiles('*');
const files = repositoryFiles('*.md').map((file) => path.join(repoRoot, file));
const contents = new Map(files.map((file) => [file, fs.readFileSync(file, 'utf8')]));
const anchors = new Map(files.map((file) => {
  const found = new Set();
  for (const match of contents.get(file).matchAll(/^#{1,6}\s+(.+)$/gm)) {
    found.add(headingAnchor(match[1].replace(/\s+#+\s*$/, '')));
  }
  return [file, found];
}));

for (const [source, markdown] of contents) {
  const relativeSource = path.relative(repoRoot, source).split(path.sep).join('/');
  if (
    /^(?:design-docs|code-review)\//.test(relativeSource)
    && /(?:\]\([^\n)]*|`[^`\n]*)research\//.test(markdown)
  ) {
    failures.push(`${relativeSource}: move durable decisions or gaps out of temporary research before referencing them`);
  }
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

  for (const match of markdown.matchAll(/`([^`\n]+)`/g)) {
    const referencedPath = match[1].trim();
    if (
      !/\.(?:cjs|css|html|js|json|md|mjs|py|toml|ts|tsx|ya?ml)$/.test(referencedPath)
      || /[*{]|→|\s/.test(referencedPath)
      || referencedPath.startsWith('/')
      || referencedPath.startsWith('~')
    ) continue;
    const exact = path.join(repoRoot, referencedPath);
    const suffix = `/${referencedPath.replaceAll('\\', '/')}`;
    const exists = fs.existsSync(exact)
      || repoFiles.some((candidate) => candidate === referencedPath || candidate.endsWith(suffix));
    const isReviewReference = path.relative(repoRoot, source).startsWith('code-review/');
    const hasRepoPrefix = /^(?:\.github|code-review|design-docs|docs|electron|mcp|native|python|release-checklists|scripts|server|shared|renderer)\//.test(referencedPath);
    if (!exists && (isReviewReference || hasRepoPrefix)) {
      failures.push(`${path.relative(repoRoot, source)}: missing referenced path ${referencedPath}`);
    }
  }
}

const forbidden = [
  'design-docs/user-journeys.md',
  'design-docs/documents.md',
  'design-docs/agent-chat.md',
  'design-docs/project-entry.md',
  'design-docs/product-direction.md',
  'design-docs/design/writing-workspace.md',
  'design-docs/design/project-context.md',
  'design-docs/use-cases.md',
  'design-docs/principles.md',
  'design-docs/product-scenarios.md',
  'design-docs/architecture.md',
  'design-docs/design/workspace.md',
  'design-docs/design/documents.md',
  'design-docs/design/agent-panel.md',
  'design-docs/design/bug-reporting.md',
  'design-docs/design/preparation.md',
  'design-docs/design/search.md',
  'design-docs/design/project.md',
  'design-docs/design/markdown.md',
  'code-review/data-layer.md',
  'code-review/ui-regression-testing.md',
];
for (const [file, markdown] of contents) {
  for (const legacy of forbidden) {
    if (markdown.includes(legacy)) failures.push(`${path.relative(repoRoot, file)}: references retired path ${legacy}`);
  }
}

const reviewDocuments = {
  'README.md': ['Intent-first Review', 'Diff-first Review', 'Review Output Contract'],
  'architecture.md': ['Runtime Ownership', 'Renderer Boundaries', 'Validation'],
  'journey-coverage.md': ['Evidence Model', 'Traceability Map', 'Maintenance Rule'],
  'release-pipeline.md': ['Implementation Map', 'Release Runbook', 'Validation for Pipeline Changes'],
};
const reviewGuide = fs.readFileSync(path.join(repoRoot, 'code-review', 'README.md'), 'utf8');
for (const name of fs.readdirSync(path.join(repoRoot, 'code-review'))) {
  if (name.endsWith('.md') && !Object.hasOwn(reviewDocuments, name)) {
    failures.push(`code-review/${name}: use the existing four review documents instead of adding a module contract`);
  }
}
for (const [name, headings] of Object.entries(reviewDocuments)) {
  const markdown = contents.get(path.join(repoRoot, 'code-review', name));
  if (!markdown) {
    failures.push(`code-review/${name}: missing review document`);
    continue;
  }
  for (const heading of headings) {
    if (!markdown.split('\n').includes(`## ${heading}`)) failures.push(`code-review/${name}: missing ${heading}`);
  }
  if (name !== 'README.md' && !reviewGuide.includes(`(${name})`)) {
    failures.push(`code-review/README.md: missing route to ${name}`);
  }
}

for (const [file, markdown] of contents) {
  if (!path.relative(repoRoot, file).startsWith('code-review/')) continue;
  for (const match of markdown.matchAll(/\bpnpm\s+([a-z][a-z0-9:_-]*)/gi)) {
    if (!packageScripts[match[1]]) {
      failures.push(`${path.relative(repoRoot, file)}: missing package script ${match[1]}`);
    }
  }
}

const designGuide = fs.readFileSync(path.join(repoRoot, 'design-docs', 'README.md'), 'utf8');
for (const category of ['journeys', 'capabilities']) {
  const directory = path.join(repoRoot, 'design-docs', category);
  if (!fs.existsSync(directory)) {
    failures.push(`design-docs/${category}: missing design category`);
    continue;
  }
  for (const name of fs.readdirSync(directory).filter((name) => name.endsWith('.md'))) {
    if (!designGuide.includes(`(${category}/${name})`)) {
      failures.push(`design-docs/README.md: missing route to ${category}/${name}`);
    }
  }
}

const journeyDoc = contents.get(path.join(repoRoot, 'design-docs/journeys/README.md')) ?? '';
if (!journeyDoc) failures.push('design-docs/journeys/README.md: missing journey definitions');
const coverageDoc = fs.readFileSync(path.join(repoRoot, 'code-review/journey-coverage.md'), 'utf8');
const journeyMatches = [...journeyDoc.matchAll(/^## (J\d{2}):[^\n]*$/gm)];
const journeyIds = journeyMatches.map((match) => match[1]);
const uniqueJourneyIds = [...new Set(journeyIds)];
const requiredJourneyHeadings = [
  'Flow',
  'Required Results',
  'Failure and Recovery',
];
const traceRows = new Map();
for (const line of coverageDoc.split('\n')) {
  if (!/^\| \[J\d{2} /.test(line)) continue;
  const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
  const id = /^\[(J\d{2}) /.exec(cells[0])?.[1];
  if (!id) continue;
  traceRows.set(id, { capabilities: cells[1] ?? '', boundaries: cells[2] ?? '' });
}
for (const [index, id] of uniqueJourneyIds.entries()) {
  const expected = `J${String(index + 1).padStart(2, '0')}`;
  if (id !== expected) failures.push(`design-docs/journeys/README.md: expected ${expected}, found ${id}`);
  const headingCount = journeyIds.filter((candidate) => candidate === id).length;
  if (headingCount !== 1) failures.push(`design-docs/journeys/README.md: expected one ${id} heading, found ${headingCount}`);
  const coverageCount = [...coverageDoc.matchAll(new RegExp(`^\\| \\[${id} `, 'gm'))].length;
  if (coverageCount !== 1) failures.push(`code-review/journey-coverage.md: expected one ${id} evidence row, found ${coverageCount}`);

  const journeyMatch = journeyMatches[index];
  const nextJourneyMatch = journeyMatches[index + 1];
  const journeySection = journeyDoc.slice(
    journeyMatch.index,
    nextJourneyMatch?.index ?? journeyDoc.length,
  );
  const retired = journeySection.includes('**Retired.**');
  for (const heading of retired ? [] : requiredJourneyHeadings) {
    if (!journeySection.includes(`### ${heading}`)) {
      failures.push(`design-docs/journeys/README.md: ${id} missing ${heading}`);
    }
  }

  if (!journeySection.includes(`**Evidence:** [${id}](../../code-review/journey-coverage.md#`)) {
    failures.push(`design-docs/journeys/README.md: ${id} missing evidence route`);
  }

  const coverageHeading = new RegExp(`^## ${id}:[^\\n]*$`, 'm').exec(coverageDoc);
  if (!coverageHeading) {
    failures.push(`code-review/journey-coverage.md: missing ${id} evidence section`);
  } else {
    const followingHeading = /^## J\d{2}:[^\n]*$/gm;
    followingHeading.lastIndex = coverageHeading.index + coverageHeading[0].length;
    const nextCoverageHeading = followingHeading.exec(coverageDoc);
    const coverageSection = coverageDoc.slice(
      coverageHeading.index,
      nextCoverageHeading?.index ?? coverageDoc.indexOf('\n## Maintenance Rule', coverageHeading.index),
    );
    if (retired !== coverageSection.includes('**Status:** Retired.')) {
      failures.push(`code-review/journey-coverage.md: ${id} retirement status differs from its design`);
    }
    const labels = retired ? ['Implementation', 'Status', 'Evidence']
      : ['Implementation', 'Status', 'Contract Test', 'Driven Runtime Pass', 'AI Eval', 'Release Check'];
    for (const label of labels) {
      if (!coverageSection.includes(`**${label}:**`)) {
        failures.push(`code-review/journey-coverage.md: ${id} missing ${label}`);
      }
    }
  }

  const trace = traceRows.get(id);
  if (!trace) continue;
  const capabilityTargets = [...trace.capabilities.matchAll(/\]\(\.\.\/design-docs\/capabilities\/([^)]+\.md)\)/g)]
    .map((match) => match[1]);
  const journeyCapabilities = [...journeySection.matchAll(/\]\(\.\.\/capabilities\/([^)]+\.md)\)/g)]
    .map((match) => match[1]);
  const boundaryTargets = [...trace.boundaries.matchAll(/\]\(architecture\.md#([^)]+)\)/g)];
  if (capabilityTargets.length === 0) failures.push(`code-review/journey-coverage.md: ${id} has no shared capability`);
  if (boundaryTargets.length === 0) failures.push(`code-review/journey-coverage.md: ${id} has no engineering boundary`);
  if (JSON.stringify([...new Set(capabilityTargets)].sort()) !== JSON.stringify([...new Set(journeyCapabilities)].sort())) {
    failures.push(`code-review/journey-coverage.md: ${id} capabilities differ from its journey definition`);
  }

  for (const target of capabilityTargets) {
    const capability = path.join(repoRoot, 'design-docs', 'capabilities', target);
    if (!contents.get(capability)?.includes(`[${id}](`)) {
      failures.push(`design-docs/capabilities/${target}: missing reciprocal ${id} route from Journey Coverage`);
    }
  }
}
for (const match of coverageDoc.matchAll(/^\| \[(J\d{2}) /gm)) {
  if (!uniqueJourneyIds.includes(match[1])) {
    failures.push(`code-review/journey-coverage.md: ${match[1]} has no journey definition`);
  }
}

if (failures.length > 0) {
  console.error(`[docs] ${failures.length} validation failure(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  const journeyRange = uniqueJourneyIds.length > 0
    ? `${uniqueJourneyIds[0]}-${uniqueJourneyIds.at(-1)}`
    : 'no journeys';
  console.log(`[docs] verified ${files.length} repository Markdown files, local links, reciprocal journey routes, implementation references, documented commands, and ${journeyRange} coverage`);
}
