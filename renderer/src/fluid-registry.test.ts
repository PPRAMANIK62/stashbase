import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vite-plus/test';

const rendererRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(rendererRoot, '..');

const componentFiles = [
  'accordion.tsx',
  'ask-user-questions.tsx',
  'badge.tsx',
  'button.tsx',
  'card.tsx',
  'chat-message.tsx',
  'checkbox-group.tsx',
  'color-picker.tsx',
  'dialog.tsx',
  'dropdown.tsx',
  'file-thumbnail.tsx',
  'input-copy.tsx',
  'input-group.tsx',
  'input-message.tsx',
  'menu-item.tsx',
  'mobile-drawer.tsx',
  'radio-group.tsx',
  'scroll-area.tsx',
  'select.tsx',
  'sidebar-core.tsx',
  'sidebar-menu.tsx',
  'sidebar.tsx',
  'slider.tsx',
  'switch.tsx',
  'table.tsx',
  'tabs-subtle.tsx',
  'tabs.tsx',
  'thinking-indicator.tsx',
  'thinking-steps.tsx',
  'tooltip.tsx',
] as const;

const supportFiles = [
  'hooks/use-merge-split.tsx',
  'hooks/use-proximity-hover.ts',
  'hooks/use-touch-primary.tsx',
  'lib/elevated.tsx',
  'lib/font-weight.ts',
  'lib/icon-context.tsx',
  'lib/shape-context.tsx',
  'lib/size-context.tsx',
  'lib/springs.ts',
  'lib/surface-classes.ts',
  'lib/surface-context.tsx',
  'lib/utils.ts',
] as const;

const publicComponentStories = [
  'accordion.stories.tsx',
  'ask-user-questions.stories.tsx',
  'badge.stories.tsx',
  'button.stories.tsx',
  'card.stories.tsx',
  'chat-message.stories.tsx',
  'checkbox-group.stories.tsx',
  'color-picker.stories.tsx',
  'dialog.stories.tsx',
  'dropdown.stories.tsx',
  'file-thumbnail.stories.tsx',
  'input-copy.stories.tsx',
  'input-group.stories.tsx',
  'input-message.stories.tsx',
  'mobile-drawer.stories.tsx',
  'radio-group.stories.tsx',
  'scroll-area.stories.tsx',
  'select.stories.tsx',
  'sidebar.stories.tsx',
  'slider.stories.tsx',
  'switch.stories.tsx',
  'table.stories.tsx',
  'tabs-subtle.stories.tsx',
  'tabs.stories.tsx',
  'thinking-indicator.stories.tsx',
  'thinking-steps.stories.tsx',
  'tooltip.stories.tsx',
] as const;

describe('Fluid Functionalism registry installation', () => {
  it('uses only Fluid Base UI component sources', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(rendererRoot, 'package.json'), 'utf8'),
    );
    const componentConfig = JSON.parse(
      fs.readFileSync(path.join(rendererRoot, 'components.json'), 'utf8'),
    );
    const sources = [...componentFiles.map((name) => `components/ui/${name}`), ...supportFiles]
      .map((relativePath) => fs.readFileSync(path.join(rendererRoot, 'src', relativePath), 'utf8'))
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

  it('does not retain the replaced StashBase design-system apparatus', () => {
    const rendererPackage = JSON.parse(
      fs.readFileSync(path.join(rendererRoot, 'package.json'), 'utf8'),
    );
    const rootPackage = JSON.parse(
      fs.readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'),
    );
    expect(rendererPackage.devDependencies.storybook).toBe('10.5.10');
    expect(rootPackage.scripts.storybook).toBe('pnpm --filter @stashbase/renderer storybook');
    expect(fs.existsSync(path.join(rendererRoot, 'style-contract.json'))).toBe(false);
    expect(fs.existsSync(path.join(rendererRoot, 'FLUID_FUNCTIONALISM_LICENSE'))).toBe(false);
    expect(fs.existsSync(path.join(rendererRoot, 'public/fonts/InterVariable.ttf'))).toBe(false);
    expect(fs.existsSync(path.join(repositoryRoot, 'components.json'))).toBe(false);
    expect(fs.existsSync(path.join(repositoryRoot, 'scripts/check-renderer-styles.mjs'))).toBe(
      false,
    );
  });
});
