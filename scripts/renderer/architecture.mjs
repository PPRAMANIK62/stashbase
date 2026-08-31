#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceExtensions = new Set(['.css', '.html', '.js', '.jsx', '.json', '.mjs', '.ts', '.tsx']);
const moduleExtensions = ['.js', '.jsx', '.mjs', '.ts', '.tsx'];
const skippedDirectories = new Set(['dist', 'node_modules']);
const featureEntries = new Set(['application', 'domain', 'infrastructure', 'public.ts', 'ui']);
const approvedFeatures = new Map([
  ['agent', 'Agent Panel'],
  ['documents', 'Documents'],
  ['preparation', 'Preparation'],
  ['retrieval', 'Search and Retrieval'],
  ['settings', 'Workspace / Agent Panel'],
  ['workspace', 'Workspace'],
]);

function slash(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function sourceFiles(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.') || skippedDirectories.has(entry.name)) return [];
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return entry.isFile() && sourceExtensions.has(path.extname(entry.name)) ? [absolute] : [];
  });
}

function readDeclaration(root, violations) {
  const relativePath = 'renderer/renderer-architecture.json';
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    violations.push(`${relativePath} is required`);
    return { features: [], wireSchemaModules: [] };
  }

  let declaration;
  try {
    declaration = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    violations.push(`${relativePath} is not valid JSON: ${error.message}`);
    return { features: [], wireSchemaModules: [] };
  }

  if (!Array.isArray(declaration.features)) {
    violations.push(`${relativePath} must declare a features array`);
  }
  if (!Array.isArray(declaration.wireSchemaModules)) {
    violations.push(`${relativePath} must declare a wireSchemaModules array`);
  }

  return {
    features: Array.isArray(declaration.features) ? declaration.features : [],
    wireSchemaModules: Array.isArray(declaration.wireSchemaModules)
      ? declaration.wireSchemaModules
      : [],
  };
}

function checkFeatureDeclaration(root, features, violations) {
  const declared = new Map();
  for (const feature of features) {
    if (
      !feature ||
      typeof feature.name !== 'string' ||
      typeof feature.productArea !== 'string'
    ) {
      violations.push('renderer feature declarations require string name and productArea fields');
      continue;
    }
    if (declared.has(feature.name)) {
      violations.push(`renderer feature ${feature.name} is declared more than once`);
      continue;
    }
    declared.set(feature.name, feature.productArea);
  }

  for (const [name, productArea] of approvedFeatures) {
    if (declared.get(name) !== productArea) {
      violations.push(`renderer feature ${name} must be owned by ${productArea}`);
    }
  }
  for (const name of declared.keys()) {
    if (!approvedFeatures.has(name)) {
      violations.push(`renderer feature ${name} has no approved architecture owner`);
    }
  }

  const featuresRoot = path.join(root, 'renderer', 'src', 'features');
  if (!fs.existsSync(featuresRoot)) return;

  for (const featureDirectory of fs.readdirSync(featuresRoot, { withFileTypes: true })) {
    if (featureDirectory.name.startsWith('.')) continue;
    if (!featureDirectory.isDirectory()) {
      violations.push(`renderer/src/features/${featureDirectory.name} must be an owned feature directory`);
      continue;
    }
    const featureName = featureDirectory.name;
    const relativeFeature = `renderer/src/features/${featureName}`;
    if (!declared.has(featureName)) {
      violations.push(`${relativeFeature} has no feature ownership declaration`);
    }

    const absoluteFeature = path.join(featuresRoot, featureName);
    const entries = fs.readdirSync(absoluteFeature, { withFileTypes: true });
    for (const entry of entries) {
      if (!featureEntries.has(entry.name)) {
        violations.push(`${relativeFeature}/${entry.name} is not an approved feature layer`);
      } else if (entry.name === 'public.ts' && !entry.isFile()) {
        violations.push(`${relativeFeature}/public.ts must be a file`);
      } else if (entry.name !== 'public.ts' && !entry.isDirectory()) {
        violations.push(`${relativeFeature}/${entry.name} must be a directory`);
      }
    }
    if (!entries.some((entry) => entry.isFile() && entry.name === 'public.ts')) {
      violations.push(`${relativeFeature}/public.ts is required for an implemented feature`);
    }
  }
}

function checkWireSchemaDeclaration(root, wireSchemaModules, violations) {
  const registered = new Set();
  for (const modulePath of wireSchemaModules) {
    if (typeof modulePath !== 'string' || !/^shared\/.+\.(?:js|mjs|ts)$/.test(modulePath)) {
      violations.push(`wire schema module ${String(modulePath)} must be a file under shared/`);
      continue;
    }
    if (registered.has(modulePath)) {
      violations.push(`wire schema module ${modulePath} is registered more than once`);
      continue;
    }
    registered.add(modulePath);
    if (!fs.existsSync(path.join(root, modulePath))) {
      violations.push(`registered wire schema module ${modulePath} does not exist`);
    }
  }

  const rendererRoot = path.join(root, 'renderer');
  const sharedRoot = path.join(root, 'shared');
  for (const absolute of sourceFiles(path.join(rendererRoot, 'src'))) {
    const source = fs.readFileSync(absolute, 'utf8');
    const importPattern =
      /\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"](?<specifier>[^'"]+)['"]/g;
    for (const match of source.matchAll(importPattern)) {
      const specifier = match.groups?.specifier;
      if (!specifier) continue;
      const resolved = specifier.startsWith('@/protocols/')
        ? path.join(sharedRoot, 'protocols', specifier.slice('@/protocols/'.length))
        : specifier.startsWith('.')
          ? path.resolve(path.dirname(absolute), specifier)
          : null;
      if (!resolved) continue;
      const isSharedImport =
        resolved === sharedRoot || resolved.startsWith(`${sharedRoot}${path.sep}`);
      if (!isSharedImport) continue;

      const candidates = [
        resolved,
        ...moduleExtensions.map((extension) => `${resolved}${extension}`),
        ...moduleExtensions.map((extension) => path.join(resolved, `index${extension}`)),
      ];
      const registeredPath = candidates
        .map((candidate) => slash(path.relative(root, candidate)))
        .find((candidate) => registered.has(candidate));
      if (!registeredPath) {
        violations.push(
          `${slash(path.relative(root, absolute))} imports an unregistered repository wire module ${specifier}`,
        );
      }
    }
  }
}

export function findRendererArchitectureViolations(root = repositoryRoot) {
  const violations = [];
  const declaration = readDeclaration(root, violations);
  checkFeatureDeclaration(root, declaration.features, violations);
  checkWireSchemaDeclaration(root, declaration.wireSchemaModules, violations);

  const sharedTypes = path.join(root, 'renderer', 'src', 'shared', 'types');
  if (fs.existsSync(sharedTypes)) {
    violations.push('renderer/src/shared/types is forbidden; use the reviewed shared domain kernel');
  }

  for (const absolute of sourceFiles(path.join(root, 'renderer'))) {
    const source = fs.readFileSync(absolute, 'utf8');
    const relative = slash(path.relative(root, absolute));
    for (const forbidden of ['web-src', '../server/', '../electron/']) {
      if (source.includes(forbidden)) {
        violations.push(`${relative} references forbidden implementation path ${forbidden}`);
      }
    }
    const importPattern =
      /\b(?:(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?|import\s*\(\s*|require\s*\(\s*)['"](?<specifier>\.\.\/[^'"]+)['"]/g;
    for (const match of source.matchAll(importPattern)) {
      violations.push(
        `${relative} uses parent-relative import ${match.groups.specifier}; use ./ or @/`,
      );
    }
  }

  return violations.sort();
}

export function checkRendererArchitecture(root = repositoryRoot) {
  const violations = findRendererArchitectureViolations(root);
  if (violations.length === 0) return;
  throw new Error(`Renderer architecture violations:\n${violations.join('\n')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkRendererArchitecture();
  console.log('renderer architecture check passed');
}
