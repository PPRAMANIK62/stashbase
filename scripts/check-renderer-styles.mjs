#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contractPath = 'renderer/style-contract.json';
const contractGroups = ['foundationTokens', 'semanticTokens', 'tailwindTokens'];
const sourceExtensions = new Set(['.css', '.js', '.jsx', '.mjs', '.ts', '.tsx']);
const rawColorPattern = /#[\da-f]{3,8}\b|(?:color|hsl|hwb|lab|lch|oklch|rgb)a?\(/i;
const paletteNames = [
  'amber',
  'black',
  'blue',
  'cyan',
  'emerald',
  'fuchsia',
  'gray',
  'green',
  'indigo',
  'lime',
  'neutral',
  'orange',
  'pink',
  'purple',
  'red',
  'rose',
  'sky',
  'slate',
  'stone',
  'teal',
  'violet',
  'white',
  'yellow',
  'zinc',
];

function slash(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function sourceFiles(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') return [];
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return entry.isFile() && sourceExtensions.has(path.extname(entry.name)) ? [absolute] : [];
  });
}

function readContract(root, violations) {
  const absolute = path.join(root, contractPath);
  if (!fs.existsSync(absolute)) {
    violations.push(`${contractPath} is required`);
    return undefined;
  }

  let contract;
  try {
    contract = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  } catch (error) {
    violations.push(`${contractPath} is not valid JSON: ${error.message}`);
    return undefined;
  }

  if (typeof contract.canonicalStylesheet !== 'string') {
    violations.push(`${contractPath} requires a canonicalStylesheet path`);
  }
  for (const group of [...contractGroups, 'utilities']) {
    if (!Array.isArray(contract[group])) {
      violations.push(`${contractPath} requires a ${group} array`);
    }
  }
  if (violations.length > 0) return undefined;

  const owners = new Map();
  for (const group of contractGroups) {
    for (const token of contract[group]) {
      if (typeof token !== 'string' || !/^--[a-z][a-z0-9-]*$/.test(token)) {
        violations.push(`${contractPath} ${group} contains invalid token ${String(token)}`);
        continue;
      }
      if (owners.has(token)) {
        violations.push(
          `${contractPath} token ${token} is owned by both ${owners.get(token)} and ${group}`,
        );
      } else {
        owners.set(token, group);
      }
    }
  }
  for (const utility of contract.utilities) {
    if (typeof utility !== 'string' || !/^[a-z][a-z0-9-]*$/.test(utility)) {
      violations.push(`${contractPath} utilities contains invalid utility ${String(utility)}`);
    }
  }

  return { ...contract, owners };
}

function declarations(source) {
  const result = new Map();
  const pattern = /^\s*(?<name>--[a-z][a-z0-9-]*)\s*:\s*(?<value>[^;]+);/gim;
  for (const match of source.matchAll(pattern)) {
    const entries = result.get(match.groups.name) ?? [];
    entries.push(match.groups.value.trim());
    result.set(match.groups.name, entries);
  }
  return result;
}

function classTokens(source, absolute) {
  const tokens = [];

  const sourceFile = ts.createSourceFile(
    absolute,
    source,
    ts.ScriptTarget.Latest,
    true,
    absolute.endsWith('.tsx') || absolute.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const collectStrings = (node) => {
    if (ts.isStringLiteralLike(node)) {
      tokens.push(...node.text.split(/\s+/).filter(Boolean));
      return;
    }
    ts.forEachChild(node, collectStrings);
  };
  const visit = (node) => {
    if (ts.isJsxAttribute(node) && node.name.text === 'className' && node.initializer) {
      collectStrings(node.initializer);
    } else if (
      ts.isPropertyAssignment(node) &&
      ((ts.isIdentifier(node.name) && node.name.text === 'className') ||
        (ts.isStringLiteral(node.name) && node.name.text === 'className'))
    ) {
      collectStrings(node.initializer);
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      (node.expression.text === 'cn' || node.expression.text === 'cva')
    ) {
      for (const argument of node.arguments) collectStrings(argument);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  for (const apply of source.matchAll(/@apply\s+(?<value>[^;]+);/g)) {
    tokens.push(...apply.groups.value.trim().split(/\s+/));
  }
  return tokens;
}

function visualStringTokens(source) {
  const tokens = [];
  const literalPattern = /(?<quote>['"`])(?<value>(?:\\.|(?!\k<quote>)[\s\S])*?)\k<quote>/g;
  for (const literal of source.matchAll(literalPattern)) {
    for (const token of literal.groups.value.split(/\s+/)) {
      if (token.includes('-') || token.includes('[')) tokens.push(token);
    }
  }
  return tokens;
}

function roleNames(tokens, prefix, excludedSuffix) {
  return new Set(
    tokens
      .filter((token) => token.startsWith(prefix) && !token.endsWith(excludedSuffix ?? '\0'))
      .map((token) => token.slice(prefix.length)),
  );
}

function styleRoles(contract) {
  const tailwindTokens = contract.tailwindTokens;
  return {
    colors: roleNames(tailwindTokens, '--color-'),
    easings: roleNames(tailwindTokens, '--ease-'),
    fontFamilies: new Set(
      [...roleNames(tailwindTokens, '--font-')].filter((role) => !role.startsWith('weight-')),
    ),
    fontWeights: roleNames(tailwindTokens, '--font-weight-'),
    leading: roleNames(tailwindTokens, '--leading-'),
    opacities: roleNames(tailwindTokens, '--opacity-'),
    radii: roleNames(tailwindTokens, '--radius-'),
    shadows: roleNames(tailwindTokens, '--shadow-'),
    stacking: roleNames(tailwindTokens, '--z-'),
    text: new Set(
      [...roleNames(tailwindTokens, '--text-')].filter((role) => !role.includes('--line-height')),
    ),
    tracking: roleNames(tailwindTokens, '--tracking-'),
    utilities: new Set(contract.utilities),
  };
}

function inspectClassToken(token, roles, relative, violations) {
  if (/^-?\[[^\]]+\](?::|$)|-\[[^\]]+\]/.test(token)) {
    violations.push(`${relative} uses arbitrary visual utility ${token}`);
    return;
  }

  const base = token.replace(/^!/, '').split(':').at(-1);
  if (!base || !/^[a-z-]/.test(base)) return;

  const palettePattern = new RegExp(
    `^(?:bg|border|decoration|divide|fill|from|outline|ring|shadow|stroke|text|to|via)-(?:${paletteNames.join('|')})(?:$|[-/])`,
  );
  if (palettePattern.test(base)) {
    violations.push(`${relative} uses raw palette utility ${token}`);
    return;
  }

  const suffix = (prefix) => base.slice(prefix.length).split('/')[0];
  const undeclared = (kind) => violations.push(`${relative} uses undeclared ${kind} role ${token}`);

  if (base.startsWith('bg-')) {
    if (!roles.colors.has(suffix('bg-')) && suffix('bg-') !== 'none') undeclared('color');
    return;
  }
  if (base.startsWith('text-')) {
    const value = suffix('text-');
    const behavior =
      /^(?:balance|center|clip|ellipsis|end|justify|left|nowrap|pretty|right|start|wrap)$/;
    if (!roles.colors.has(value) && !roles.text.has(value) && !behavior.test(value)) {
      undeclared('text');
    }
    return;
  }
  if (base.startsWith('border-')) {
    const value = suffix('border-');
    const structure = /^(?:[trblxyse](?:-[0248])?|[0248]|dashed|dotted|double|hidden|none|solid)$/;
    if (!roles.colors.has(value) && !structure.test(value)) undeclared('border');
    return;
  }
  if (base.startsWith('outline-offset-')) return;
  if (base.startsWith('outline-')) {
    const value = suffix('outline-');
    if (
      !roles.colors.has(value) &&
      !/^(?:[01248]|dashed|dotted|double|hidden|none|solid)$/.test(value)
    ) {
      undeclared('outline');
    }
    return;
  }
  if (base.startsWith('ring-offset-')) return;
  if (base.startsWith('ring-')) {
    const value = suffix('ring-');
    if (!roles.colors.has(value) && !/^(?:[01248]|inset)$/.test(value)) undeclared('ring');
    return;
  }
  for (const prefix of ['decoration-', 'divide-', 'fill-', 'from-', 'stroke-', 'to-', 'via-']) {
    if (base.startsWith(prefix)) {
      if (!roles.colors.has(suffix(prefix))) undeclared('color');
      return;
    }
  }
  if (base === 'shadow') {
    undeclared('shadow');
    return;
  }
  if (base.startsWith('shadow-')) {
    if (!roles.shadows.has(suffix('shadow-'))) undeclared('shadow');
    return;
  }
  if (base === 'rounded') {
    undeclared('radius');
    return;
  }
  if (base.startsWith('rounded-')) {
    const value = suffix('rounded-').replace(/^(?:[trbl]|tl|tr|br|bl|ss|se|ee|es)-/, '');
    if (!roles.radii.has(value)) undeclared('radius');
    return;
  }
  if (base.startsWith('duration-')) {
    if (base !== 'duration-0' && !roles.utilities.has(base)) undeclared('duration');
    return;
  }
  if (base.startsWith('ease-')) {
    if (!roles.easings.has(suffix('ease-'))) undeclared('easing');
    return;
  }
  if (base.startsWith('opacity-')) {
    if (!roles.opacities.has(suffix('opacity-'))) undeclared('opacity');
    return;
  }
  if (base.startsWith('font-')) {
    const value = suffix('font-');
    if (!roles.fontFamilies.has(value) && !roles.fontWeights.has(value)) undeclared('font');
    return;
  }
  if (base.startsWith('leading-')) {
    if (!roles.leading.has(suffix('leading-'))) undeclared('line-height');
    return;
  }
  if (base.startsWith('tracking-')) {
    if (!roles.tracking.has(suffix('tracking-'))) undeclared('letter-spacing');
    return;
  }
  if (base.startsWith('z-')) {
    if (!roles.stacking.has(suffix('z-'))) undeclared('stacking');
  }
}

function inspectSource(root, absolute, contract, declaredTokens, violations) {
  const relative = slash(path.relative(root, absolute));
  const source = fs.readFileSync(absolute, 'utf8');
  if (path.extname(absolute) === '.css' && relative !== contract.canonicalStylesheet) {
    violations.push(
      `${relative} is forbidden; renderer CSS belongs in ${contract.canonicalStylesheet}`,
    );
    return;
  }
  if (relative === contract.canonicalStylesheet) return;

  if (/\bstyle\s*=/.test(source)) {
    violations.push(`${relative} uses an inline style prop`);
  }
  if (rawColorPattern.test(source)) {
    violations.push(`${relative} contains a raw color literal`);
  }
  for (const reference of source.matchAll(/var\(\s*(?<name>--[a-z][a-z0-9-]*)/gi)) {
    if (!declaredTokens.has(reference.groups.name)) {
      violations.push(`${relative} references undeclared token ${reference.groups.name}`);
    }
  }

  const roles = styleRoles(contract);
  for (const token of new Set([...classTokens(source, absolute), ...visualStringTokens(source)])) {
    inspectClassToken(token, roles, relative, violations);
  }
}

export function findRendererStyleViolations(root = repositoryRoot) {
  const violations = [];
  const contract = readContract(root, violations);
  if (!contract) return violations.sort();

  const canonical = path.join(root, contract.canonicalStylesheet);
  if (!fs.existsSync(canonical)) {
    violations.push(`${contract.canonicalStylesheet} is required by ${contractPath}`);
    return violations.sort();
  }

  const stylesheet = fs.readFileSync(canonical, 'utf8');
  const declared = declarations(stylesheet);
  const approved = new Set(contract.owners.keys());
  const roles = styleRoles(contract);
  for (const token of approved) {
    if (!declared.has(token))
      violations.push(`${contract.canonicalStylesheet} omits approved token ${token}`);
  }
  for (const token of declared.keys()) {
    if (!approved.has(token))
      violations.push(`${contract.canonicalStylesheet} declares unapproved token ${token}`);
  }
  for (const reference of stylesheet.matchAll(/var\(\s*(?<name>--[a-z][a-z0-9-]*)/gi)) {
    if (!declared.has(reference.groups.name)) {
      violations.push(
        `${contract.canonicalStylesheet} references undeclared token ${reference.groups.name}`,
      );
    }
  }

  const semanticColorToken =
    /^--(?:accent|background|border|card|chart-|destructive|foreground|input|muted|popover|primary|ring|secondary|shadow-(?:edge|high|low)-color|sidebar|surface-)/;
  for (const token of contract.semanticTokens.filter((name) => semanticColorToken.test(name))) {
    for (const value of declared.get(token) ?? []) {
      if (rawColorPattern.test(value)) {
        violations.push(
          `${contract.canonicalStylesheet} maps semantic color ${token} from a raw literal`,
        );
      }
    }
  }
  for (const token of contract.tailwindTokens) {
    for (const value of declared.get(token) ?? []) {
      if (!value.includes('var(--')) {
        violations.push(
          `${contract.canonicalStylesheet} Tailwind token ${token} must map an approved role`,
        );
      }
    }
  }

  for (const apply of stylesheet.matchAll(/@apply\s+(?<value>[^;]+);/g)) {
    for (const utility of apply.groups.value.trim().split(/\s+/)) {
      inspectClassToken(utility, roles, contract.canonicalStylesheet, violations);
    }
  }
  const withoutTokenDeclarations = stylesheet.replace(/^\s*--[a-z][a-z0-9-]*\s*:\s*[^;]+;/gim, '');
  const visualDeclaration =
    /^\s*(?<property>(?:animation|transition)-duration|background(?:-color)?|border(?:-[a-z-]+)?-color|border-radius|box-shadow|color|font-size|letter-spacing|line-height|opacity|text-shadow|z-index)\s*:\s*(?<value>[^;]+);/gim;
  for (const declaration of withoutTokenDeclarations.matchAll(visualDeclaration)) {
    const value = declaration.groups.value.trim();
    const reducedMotionOverride =
      (declaration.groups.property === 'animation-duration' ||
        declaration.groups.property === 'transition-duration') &&
      value === '0.01ms !important';
    if (!value.includes('var(--') && !reducedMotionOverride) {
      violations.push(
        `${contract.canonicalStylesheet} sets raw ${declaration.groups.property} value ${value}`,
      );
    }
  }

  const declaredUtilities = new Set(
    [...stylesheet.matchAll(/@utility\s+(?<name>[a-z][a-z0-9-]*)/g)].map(
      (match) => match.groups.name,
    ),
  );
  for (const utility of contract.utilities) {
    if (!declaredUtilities.has(utility)) {
      violations.push(`${contract.canonicalStylesheet} omits approved utility ${utility}`);
    }
  }
  for (const utility of declaredUtilities) {
    if (!contract.utilities.includes(utility)) {
      violations.push(`${contract.canonicalStylesheet} declares unapproved utility ${utility}`);
    }
  }

  const roots = [path.join(root, 'renderer', 'src'), path.join(root, 'renderer', '.storybook')];
  for (const absolute of roots.flatMap((sourceRoot) => sourceFiles(sourceRoot))) {
    inspectSource(root, absolute, contract, declared, violations);
  }

  return [...new Set(violations)].sort();
}

export function checkRendererStyles(root = repositoryRoot) {
  const violations = findRendererStyleViolations(root);
  if (violations.length === 0) return;
  throw new Error(`Renderer style violations:\n${violations.join('\n')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkRendererStyles();
  console.log('renderer style check passed');
}
