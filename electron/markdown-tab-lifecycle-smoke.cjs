'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: sleep } = require('node:timers/promises');
const { app, BrowserWindow } = require('electron');

const smokeRoot = process.env.STASHBASE_SMOKE_ROOT;
if (!smokeRoot) throw new Error('STASHBASE_SMOKE_ROOT is required');
app.setPath('userData', path.join(smokeRoot, 'markdown-lifecycle-electron-user-data'));

const deadline = setTimeout(() => {
  console.error('Markdown tab lifecycle smoke timed out');
  process.exitCode = 1;
  app.quit();
}, 90_000);

async function waitFor(predicate, message, timeoutMs = 30_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const value = await predicate();
    if (value) return value;
    await sleep(50);
  }
  throw new Error(message);
}

async function waitForRenderer(win) {
  await waitFor(
    () => !win.isDestroyed() && !win.webContents.isLoadingMainFrame(),
    'renderer did not finish loading',
  );
  await win.webContents.executeJavaScript(
    "new Promise((resolve) => { if (document.readyState === 'complete') resolve(true); else window.addEventListener('load', () => resolve(true), { once: true }); })",
  );
}

function largeNote(title, marker) {
  const sections = Array.from({ length: 700 }, (_, index) => (
    `## ${title} section ${index + 1}\n\n${marker} paragraph ${index + 1} `
    + 'retains its rendered Markdown surface across repeated tab switches. '.repeat(3)
  ));
  return `# ${title}\n\n${sections.join('\n\n')}`;
}

async function clickFile(win, name, eventType) {
  await win.webContents.executeJavaScript(`
    (() => {
      const row = document.querySelector('.tree-row.file[data-path=${JSON.stringify(name)}]');
      if (!row) throw new Error('missing file row: ' + ${JSON.stringify(name)});
      row.dispatchEvent(new MouseEvent(${JSON.stringify(eventType)}, { bubbles: true, cancelable: true }));
    })()
  `);
}

async function clickTab(win, name) {
  await win.webContents.executeJavaScript(`
    (() => {
      const tab = Array.from(document.querySelectorAll('.tab')).find((candidate) =>
        candidate.querySelector('.tab-label')?.textContent === ${JSON.stringify(name)}
      );
      if (!tab) throw new Error('missing tab: ' + ${JSON.stringify(name)});
      tab.click();
    })()
  `);
}

async function waitForActiveReady(win, name) {
  await waitFor(
    () => win.webContents.executeJavaScript(`
      (() => {
        const activeLabel = document.querySelector('.tab.active .tab-label')?.textContent;
        const surface = document.querySelector('.markdown-tab-layer:not([hidden]) .crepe-surface');
        return activeLabel === ${JSON.stringify(name)}
          && surface?.dataset.documentName === ${JSON.stringify(name)}
          && surface.dataset.state === 'ready'
          && Boolean(surface.querySelector('.ProseMirror'));
      })()
    `),
    `Markdown surface did not become ready for ${name}`,
  );
}

async function run() {
  const folder = path.join(smokeRoot, 'folders', 'markdown-lifecycle');
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'alpha.md'), largeNote('Alpha', 'ALPHA_UNIQUE'), 'utf8');
  fs.writeFileSync(path.join(folder, 'beta.md'), largeNote('Beta', 'BETA_UNIQUE'), 'utf8');
  fs.writeFileSync(path.join(folder, 'preview-one.md'), '# Preview one\n\nFirst preview identity.', 'utf8');
  fs.writeFileSync(path.join(folder, 'preview-two.md'), '# Preview two\n\nReplacement preview identity.', 'utf8');

  const win = await waitFor(
    () => BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed()),
    'real main entry did not create its initial window',
  );
  await waitForRenderer(win);
  const origin = new URL(win.webContents.getURL()).origin;
  await win.loadURL(`${origin}/?folder=${encodeURIComponent(folder)}`);
  await waitForRenderer(win);
  await waitFor(
    () => win.webContents.executeJavaScript("document.querySelectorAll('.tree-row.file').length >= 4"),
    'Markdown lifecycle files did not appear in the renderer',
  );

  await win.webContents.executeJavaScript(`
    (() => {
      window.__stashbaseMarkdownSmoke = { violations: [] };
      const inspect = (source) => {
        const layer = document.querySelector('.main.fmt-md .markdown-tab-layer:not([hidden])');
        if (!layer) return;
        const intentional = layer.querySelector('.crepe-status, .doc-loading, .lazy-load-error');
        const rendered = layer.querySelector('.ProseMirror');
        if (!intentional && !rendered) {
          window.__stashbaseMarkdownSmoke.violations.push(source + ': naked active Markdown surface');
        }
      };
      window.__stashbaseMarkdownSmoke.observer = new MutationObserver(() => inspect('mutation'));
      window.__stashbaseMarkdownSmoke.observer.observe(document.querySelector('.main-body'), {
        attributes: true,
        childList: true,
        subtree: true,
      });
      window.__stashbaseMarkdownSmoke.inspect = inspect;
    })()
  `);

  await clickFile(win, 'alpha.md', 'dblclick');
  await waitForActiveReady(win, 'alpha.md');
  await clickFile(win, 'beta.md', 'dblclick');
  await waitForActiveReady(win, 'beta.md');
  await waitFor(
    () => win.webContents.executeJavaScript("document.querySelectorAll('.crepe-surface[data-state=ready] .ProseMirror').length === 2"),
    'both pinned Markdown documents were not retained',
  );

  await win.webContents.executeJavaScript(`
    (() => {
      window.__stashbaseMarkdownSmoke.alpha =
        document.querySelector('.crepe-surface[data-document-name="alpha.md"] .ProseMirror');
      window.__stashbaseMarkdownSmoke.beta =
        document.querySelector('.crepe-surface[data-document-name="beta.md"] .ProseMirror');
    })()
  `);

  for (let iteration = 0; iteration < 4; iteration += 1) {
    for (const name of ['alpha.md', 'beta.md']) {
      await clickTab(win, name);
      await waitForActiveReady(win, name);
      await win.webContents.executeJavaScript(`
        new Promise((resolve) => {
          let frames = 0;
          const sample = () => {
            window.__stashbaseMarkdownSmoke.inspect('animation-frame');
            frames += 1;
            if (frames === 4) resolve(true); else requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        })
      `);
    }
  }

  const retention = await win.webContents.executeJavaScript(`
    (() => ({
      alpha: window.__stashbaseMarkdownSmoke.alpha
        === document.querySelector('.crepe-surface[data-document-name="alpha.md"] .ProseMirror'),
      beta: window.__stashbaseMarkdownSmoke.beta
        === document.querySelector('.crepe-surface[data-document-name="beta.md"] .ProseMirror'),
      violations: window.__stashbaseMarkdownSmoke.violations.slice(),
    }))()
  `);
  assert.equal(retention.alpha, true, 'alpha editor DOM identity changed across tab switches');
  assert.equal(retention.beta, true, 'beta editor DOM identity changed across tab switches');
  assert.deepEqual(retention.violations, []);

  await win.webContents.executeJavaScript("document.querySelector('.edit-toggle').click()");
  await waitFor(
    () => win.webContents.executeJavaScript("document.querySelector('.markdown-tab-layer:not([hidden]) .crepe-shell')?.classList.contains('crepe-readonly')"),
    'Reading View did not activate',
  );
  await win.webContents.executeJavaScript("document.querySelector('.edit-toggle').click()");
  await waitFor(
    () => win.webContents.executeJavaScript("!document.querySelector('.markdown-tab-layer:not([hidden]) .crepe-shell')?.classList.contains('crepe-readonly')"),
    'Live Editing did not reactivate',
  );
  assert.equal(
    await win.webContents.executeJavaScript(`window.__stashbaseMarkdownSmoke.beta
      === document.querySelector('.crepe-surface[data-document-name="beta.md"] .ProseMirror')`),
    true,
    'mode switching replaced the retained editor DOM',
  );

  await win.webContents.executeJavaScript(`
    (() => {
      const event = new KeyboardEvent('keydown', {
        key: 'f',
        ${process.platform === 'darwin' ? 'metaKey: true' : 'ctrlKey: true'},
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);
    })()
  `);
  await waitFor(
    () => win.webContents.executeJavaScript("Boolean(document.querySelector('.find-input'))"),
    'Find did not open for the active Markdown surface',
  );
  await win.webContents.executeJavaScript(`
    (() => {
      const input = document.querySelector('.find-input');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'BETA_UNIQUE');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()
  `);
  await waitFor(
    () => win.webContents.executeJavaScript("document.querySelector('.find-count')?.textContent !== '0/0'"),
    'active beta Find controller did not report matches',
  );
  await clickTab(win, 'alpha.md');
  await waitForActiveReady(win, 'alpha.md');
  await waitFor(
    () => win.webContents.executeJavaScript("document.querySelector('.find-count')?.textContent === '0/0'"),
    'inactive beta Find controller remained registered',
  );

  await clickFile(win, 'preview-one.md', 'click');
  await waitForActiveReady(win, 'preview-one.md');
  await win.webContents.executeJavaScript(`window.__stashbaseMarkdownSmoke.previewOne =
    document.querySelector('.crepe-surface[data-document-name="preview-one.md"] .ProseMirror')`);
  await clickFile(win, 'preview-two.md', 'click');
  await waitForActiveReady(win, 'preview-two.md');
  assert.equal(
    await win.webContents.executeJavaScript(`!window.__stashbaseMarkdownSmoke.previewOne.isConnected
      && !document.querySelector('.crepe-surface[data-document-name="preview-one.md"]')`),
    true,
    'replaced preview editor was not destroyed',
  );

  await win.webContents.executeJavaScript(`
    (() => {
      const betaTab = Array.from(document.querySelectorAll('.tab')).find((candidate) =>
        candidate.querySelector('.tab-label')?.textContent === 'beta.md'
      );
      betaTab.querySelector('.tab-close').click();
    })()
  `);
  await waitFor(
    () => win.webContents.executeJavaScript("!document.querySelector('.crepe-surface[data-document-name=\"beta.md\"]')"),
    'closed pinned Markdown editor was not destroyed',
  );
  assert.equal(
    await win.webContents.executeJavaScript('window.__stashbaseMarkdownSmoke.alpha.isConnected'),
    true,
    'closing another tab destroyed the retained alpha editor',
  );

  await win.webContents.executeJavaScript('window.__stashbaseMarkdownSmoke.observer.disconnect()');
  clearTimeout(deadline);
  console.log('real Markdown tab lifecycle smoke passed');
  app.quit();
}

require('./main.cjs');
app.whenReady()
  .then(run)
  .catch((err) => {
    clearTimeout(deadline);
    console.error(err);
    process.exitCode = 1;
    app.quit();
  });
