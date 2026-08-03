import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('renderer foundation keeps Tailwind utility-only and maps semantic tokens', () => {
  const styles = read('web-src/src/styles.css');
  assert.match(styles, /tailwindcss\/theme\.css/);
  assert.match(styles, /tailwindcss\/utilities\.css/);
  assert.doesNotMatch(styles, /tailwindcss\/preflight\.css/);
  for (const token of [
    'background', 'foreground', 'pane', 'card', 'border', 'accent', 'focus', 'danger',
    'status-info', 'status-success', 'status-warning', 'status-danger',
  ]) {
    assert.match(styles, new RegExp(`--color-${token}:`));
  }
  assert.match(styles, /--spacing-density:/);
  assert.match(styles, /--radius-control:/);
});

test('shadcn generation is configured for Base UI and renderer aliases', () => {
  const config = JSON.parse(read('components.json')) as Record<string, unknown>;
  assert.equal(config.style, 'base-nova');
  assert.equal(config.rsc, false);
  assert.equal((config.tailwind as { css?: string }).css, 'web-src/src/styles.css');
  assert.equal((config.aliases as { ui?: string }).ui, '@/components/ui');
});

test('new foundation paths use Base UI and reduced-motion-aware Motion', () => {
  assert.match(read('web-src/src/App.tsx'), /@base-ui\/react\/button/);
  assert.match(read('web-src/src/components/ModalShell.tsx'), /@base-ui\/react\/dialog/);
  assert.match(read('web-src/src/main.tsx'), /MotionConfig reducedMotion="user"/);
  assert.match(read('web-src/src/components/Overlays.tsx'), /AnimatePresence/);
  const globals = read('web-src/src/styles/globals.css');
  assert.match(globals, /transition-property: opacity, color, background-color/);
  assert.doesNotMatch(globals, /animation-duration: 1ms/);
  assert.match(read('web-src/src/styles/mainpane.css'), /\.toast \{\s*animation: toast-fade/);
});
