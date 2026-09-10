import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vite-plus/test';

const rendererRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const componentFiles = [
  'badge.tsx',
  'button.tsx',
  'chat-message.tsx',
  'dialog.tsx',
  'dropdown.tsx',
  'elevated.tsx',
  'file-thumbnail.tsx',
  'input-group.tsx',
  'input-message.tsx',
  'menu-item.tsx',
  'mobile-drawer.tsx',
  'scroll-area.tsx',
  'select.tsx',
  'sidebar-core.tsx',
  'sidebar-menu.tsx',
  'sidebar.tsx',
  'switch.tsx',
  'table.tsx',
  'tabs-subtle.tsx',
  'tabs.tsx',
  'thinking-indicator.tsx',
  'thinking-steps.tsx',
  'tooltip.tsx',
  'weighted-label.tsx',
] as const;

/** Parts a primitive is built OUT of, not parts a product surface installs.
 *  They live under components/internal so the public directory stays the list
 *  of things a caller can reach for; each one has to be reachable from a
 *  components/ui module, which is what keeps "internal" from meaning "unused". */
const internalDirectory = path.join(rendererRoot, 'src/components/internal');

const supportFiles = [
  'lib/focus-ring.ts',
  'lib/font-weight.ts',
  'lib/icon-context.tsx',
  'lib/merge-refs.ts',
  'lib/proximity-geometry.ts',
  'lib/shape-context.ts',
  'lib/size-context.tsx',
  'lib/slot-template.tsx',
  'lib/springs.ts',
  'lib/surface-classes.ts',
  'lib/surface-context.tsx',
  'lib/use-deferred-unmount.ts',
  'lib/use-dom-order-registry.ts',
  'lib/use-iso-layout-effect.ts',
  'lib/use-measured-size.ts',
  'lib/use-motion-tier.ts',
  'lib/use-proximity-hover.ts',
  'lib/use-touch-primary.tsx',
  'lib/utils.ts',
] as const;

const publicComponentStories = [
  'badge.stories.tsx',
  'button.stories.tsx',
  'chat-message.stories.tsx',
  'command-menu.stories.tsx',
  'confirm-dialog.stories.tsx',
  'dialog.stories.tsx',
  'dropdown.stories.tsx',
  'elevated.stories.tsx',
  'file-thumbnail.stories.tsx',
  'file-type-icon.stories.tsx',
  'inline-input.stories.tsx',
  'input-group.stories.tsx',
  'input-message.stories.tsx',
  'menu-item.stories.tsx',
  'mobile-drawer.stories.tsx',
  'scroll-area.stories.tsx',
  'select.stories.tsx',
  'sidebar.stories.tsx',
  'split-handle.stories.tsx',
  'switch.stories.tsx',
  'table.stories.tsx',
  'tabs-subtle.stories.tsx',
  'tabs.stories.tsx',
  'thinking-indicator.stories.tsx',
  'thinking-steps.stories.tsx',
  'tooltip.stories.tsx',
  'tree-disclosure.stories.tsx',
  'weighted-label.stories.tsx',
] as const;

const isAuxiliary = (name: string) => name.includes('.stories.') || name.includes('.test.');

const sourceFilesUnder = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFilesUnder(full);
    if (!/\.tsx?$/.test(entry.name) || isAuxiliary(entry.name)) return [];
    return [full];
  });

describe('Fluid Functionalism registry installation', () => {
  it('uses only Fluid Base UI component sources', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(rendererRoot, 'package.json'), 'utf8'),
    );
    const componentConfig = JSON.parse(
      fs.readFileSync(path.join(rendererRoot, 'components.json'), 'utf8'),
    );
    // The manifest names the entry modules a consumer imports; the scan below
    // reads every source file in both trees. Those diverge the moment an entry
    // is split into sibling modules, and a forbidden import would then land in
    // a file the manifest never mentions — so the manifest is checked for
    // integrity and the scan is what actually proves the constraint.
    for (const name of componentFiles) {
      expect(
        fs.existsSync(path.join(rendererRoot, 'src/components/ui', name)),
        `${name} is listed as a Fluid component entry but does not exist`,
      ).toBe(true);
    }
    for (const relativePath of supportFiles) {
      expect(
        fs.existsSync(path.join(rendererRoot, 'src', relativePath)),
        `${relativePath} is listed as a Fluid support module but does not exist`,
      ).toBe(true);
    }

    const sources = [
      ...sourceFilesUnder(path.join(rendererRoot, 'src/components/ui')),
      ...sourceFilesUnder(internalDirectory),
      ...sourceFilesUnder(path.join(rendererRoot, 'src/lib')),
    ]
      .map((absolute) => fs.readFileSync(absolute, 'utf8'))
      .join('\n');

    expect(componentConfig.registries).toEqual({
      '@fluid': 'https://www.fluidfunctionalism.com/r/{name}.json',
    });
    expect(packageJson.dependencies['@base-ui/react']).toBeDefined();
    expect(packageJson.dependencies['@fontsource-variable/inter']).toBeDefined();
    expect(
      Object.keys(packageJson.dependencies).some((name) => name.startsWith('@radix-ui/')),
    ).toBe(false);
    expect(sources).not.toContain('@radix-ui/');
    expect(sources).not.toContain('next/link');
    expect(sources).not.toContain('cdn.jsdelivr.net');
  });

  it('keeps the lib root exactly the registry manifest', () => {
    // A reinstall overwrites this directory, so anything local sitting in it
    // is either lost or has to be reconciled against upstream by hand. The
    // manifest is the whole contract: kit extensions live one level down in
    // lib/local, product code lives under shared/.
    const installed = fs
      .readdirSync(path.join(rendererRoot, 'src/lib'), { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !isAuxiliary(entry.name))
      .map((entry) => `lib/${entry.name}`);

    const manifest = new Set<string>(supportFiles);
    const strays = installed.filter((relativePath) => !manifest.has(relativePath));
    expect(
      strays,
      `src/lib is the installed Fluid registry and a reinstall overwrites it: ${strays.join(', ')}. Move product code under src/shared/ and kit extensions under src/lib/local/.`,
    ).toEqual([]);
    expect(new Set(installed)).toEqual(manifest);
  });

  it('provides Storybook coverage for every public Fluid component', () => {
    const storyFiles = fs
      .readdirSync(path.join(rendererRoot, 'src/components/ui'))
      .filter((name) => name.endsWith('.stories.tsx'));

    expect(new Set(storyFiles)).toEqual(new Set(publicComponentStories));
    expect(fs.existsSync(path.join(rendererRoot, '.storybook/main.ts'))).toBe(true);
    expect(fs.existsSync(path.join(rendererRoot, '.storybook/preview.tsx'))).toBe(true);
  });

  it('gives every catalogued component a bounded, intentional Storybook canvas', () => {
    for (const storyFile of publicComponentStories) {
      const source = fs.readFileSync(
        path.join(rendererRoot, 'src/components/ui', storyFile),
        'utf8',
      );
      expect(source).toContain('fluidCanvas:');
    }
  });
});

const uiDirectory = path.join(rendererRoot, 'src/components/ui');

/** Primitives allowed to exist with no product caller. Keep this empty: an
 *  entry here is a standing exemption from the "no dead primitive" rule. */
const primitivesWithoutProductCallerAllowlist: readonly string[] = [];

const importSpecifiers = (source: string): string[] =>
  [...source.matchAll(/(?:from|import)\s*\(?\s*'([^']+)'/g)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );

/** Resolves an import specifier to a `<directory>/<module>` key inside the
 *  component tree, or null for anything outside it. Both the aliased form a
 *  product surface writes and the relative form a sibling writes land on the
 *  same key, so the graph below does not care which one it is reading. */
const componentModuleKey = (specifier: string, importerDirectory: string): string | null => {
  const withoutExtension = specifier.replace(/\.tsx?$/, '');
  const aliased = withoutExtension.match(/^@\/components\/(ui|internal)\/([^/]+)$/);
  if (aliased) return `${aliased[1]}/${aliased[2]}`;
  if (!withoutExtension.startsWith('.')) return null;
  const resolved = path.resolve(importerDirectory, withoutExtension);
  const directory = path.dirname(resolved);
  if (directory === uiDirectory) return `ui/${path.basename(resolved)}`;
  if (directory === internalDirectory) return `internal/${path.basename(resolved)}`;
  return null;
};

const componentModules = (directory: string, prefix: string): string[] =>
  fs.existsSync(directory)
    ? fs
        .readdirSync(directory)
        .filter((name) => /\.tsx?$/.test(name) && !isAuxiliary(name))
        .map((name) => `${prefix}/${name.replace(/\.tsx?$/, '')}`)
    : [];

const moduleFile = (key: string): string | undefined => {
  const [prefix, name] = key.split('/');
  const directory = prefix === 'ui' ? uiDirectory : internalDirectory;
  return [`${name}.tsx`, `${name}.ts`]
    .map((candidate) => path.join(directory, candidate))
    .find((candidate) => fs.existsSync(candidate));
};

describe('component tree reachability', () => {
  const modules = [
    ...componentModules(uiDirectory, 'ui'),
    ...componentModules(internalDirectory, 'internal'),
  ];

  /** What each component module imports from the component tree. Internal
   *  parts are in the graph too, so a ui primitive keeps the internal part it
   *  is built from alive, and an internal part can lean on a ui one. */
  const imports = new Map(
    modules.map((key) => {
      const file = moduleFile(key);
      const source = file ? fs.readFileSync(file, 'utf8') : '';
      const directory = key.startsWith('ui/') ? uiDirectory : internalDirectory;
      return [
        key,
        importSpecifiers(source)
          .map((specifier) => componentModuleKey(specifier, directory))
          .filter((imported): imported is string => imported !== null && imported !== key),
      ] as const;
    }),
  );

  /** Everything the product actually reaches, following the graph inward.
   *  Neither components/ui nor components/internal counts as product code: a
   *  primitive kept alive only by its own siblings is still dead. */
  const reachable = (() => {
    const seen = new Set<string>();
    const visit = (key: string) => {
      if (seen.has(key)) return;
      seen.add(key);
      for (const next of imports.get(key) ?? []) visit(next);
    };
    for (const file of sourceFilesUnder(path.join(rendererRoot, 'src'))) {
      if (file.startsWith(`${uiDirectory}${path.sep}`)) continue;
      if (file.startsWith(`${internalDirectory}${path.sep}`)) continue;
      for (const specifier of importSpecifiers(fs.readFileSync(file, 'utf8'))) {
        const imported = componentModuleKey(specifier, path.dirname(file));
        if (imported) visit(imported);
      }
    }
    return seen;
  })();

  it('keeps every components/ui primitive reachable from product code', () => {
    const orphans = modules
      .filter((key) => key.startsWith('ui/'))
      .map((key) => key.slice('ui/'.length))
      .filter(
        (name) =>
          !reachable.has(`ui/${name}`) && !primitivesWithoutProductCallerAllowlist.includes(name),
      );

    expect(
      orphans,
      `components/ui primitives with no product caller (stories and tests do not count): ${orphans.join(', ')}. Delete them, give them a caller, or add them to primitivesWithoutProductCallerAllowlist with a reason.`,
    ).toEqual([]);
    expect(primitivesWithoutProductCallerAllowlist).toEqual([]);
  });

  it('keeps every components/internal part reachable through a public primitive', () => {
    // An internal part is not a thing a product surface installs, so it is
    // reachable only THROUGH components/ui. One that nothing public builds on
    // is dead code wearing a directory name.
    const importedByUi = new Set(
      [...imports]
        .filter(([key]) => key.startsWith('ui/'))
        .flatMap(([, specifiers]) => specifiers)
        .filter((key) => key.startsWith('internal/')),
    );
    const unreachable = modules
      .filter((key) => key.startsWith('internal/'))
      .filter((key) => !importedByUi.has(key) || !reachable.has(key));

    expect(
      unreachable,
      `components/internal parts no public primitive reaches: ${unreachable.join(', ')}. Import them from a components/ui module, or delete them.`,
    ).toEqual([]);
  });

  it('keeps product code out of components/internal', () => {
    // The directory is the boundary: a feature importing a part means the part
    // was public all along and belongs in components/ui.
    const trespassers: string[] = [];
    for (const file of sourceFilesUnder(path.join(rendererRoot, 'src'))) {
      if (file.startsWith(`${uiDirectory}${path.sep}`)) continue;
      if (file.startsWith(`${internalDirectory}${path.sep}`)) continue;
      const specifiers = importSpecifiers(fs.readFileSync(file, 'utf8'));
      if (specifiers.some((specifier) => specifier.includes('@/components/internal/'))) {
        trespassers.push(path.relative(rendererRoot, file));
      }
    }
    expect(trespassers).toEqual([]);
  });
});
