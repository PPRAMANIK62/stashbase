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
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.destroy();
  }
  app.exit(1);
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
  await waitFor(
    () => win.webContents.executeJavaScript("document.body.dataset.bootSettled === '1'"),
    'renderer did not settle its boot state',
  );
}

function largeNote(title, marker) {
  const sections = Array.from({ length: 700 }, (_, index) => (
    `## ${title} section ${index + 1}\n\n${marker} paragraph ${index + 1} `
    + 'retains its rendered Markdown surface across repeated tab switches. '.repeat(3)
  ));
  return `# ${title}\n\n| Lifecycle | Value |\n| --- | --- |\n| marker | ${marker} |\n\n`
    + `\`\`\`ts\nconst lifecycle = '${marker}';\n\`\`\`\n\n`
    + `${sections.join('\n\n')}`;
}

async function clickFile(win, name) {
  await win.webContents.executeJavaScript(`
    (() => {
      const row = document.querySelector(${JSON.stringify(`[role="treeitem"][data-path=${JSON.stringify(name)}]`)});
      if (!row) throw new Error('missing file row: ' + ${JSON.stringify(name)});
      row.click();
    })()
  `);
}

async function clickTab(win, name) {
  await win.webContents.executeJavaScript(`
    (() => {
      const tab = document.querySelector(${JSON.stringify(`[role="tab"][title=${JSON.stringify(name)}]`)});
      if (!tab) throw new Error('missing tab: ' + ${JSON.stringify(name)});
      tab.click();
    })()
  `);
}

async function clickButton(win, accessibleName) {
  await win.webContents.executeJavaScript(`
    (() => {
      const button = document.querySelector(${JSON.stringify(`button[aria-label=${JSON.stringify(accessibleName)}]`)});
      if (!button) throw new Error('missing button: ' + ${JSON.stringify(accessibleName)});
      button.click();
    })()
  `);
}

// The tab's × is pointer-only chrome (aria-hidden inside role="tab"), so it
// is addressed by its tooltip title rather than an accessible name.
async function clickTabClose(win, name) {
  await win.webContents.executeJavaScript(`
    (() => {
      const button = document.querySelector(${JSON.stringify(`button[title=${JSON.stringify(`Close ${name}`)}]`)});
      if (!button) throw new Error('missing tab close control: ' + ${JSON.stringify(name)});
      button.click();
    })()
  `);
}

async function waitForActiveReady(win, name) {
  await waitFor(
    () => win.webContents.executeJavaScript(`
      (() => {
        const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
        const surface = document.querySelector(${JSON.stringify(`[role="tabpanel"] [role="region"][aria-label=${JSON.stringify(`${name} Markdown document`)}]`)});
        return activeTab?.getAttribute('title') === ${JSON.stringify(name)}
          && surface
          && !surface.hidden
          && surface.dataset.state === 'ready'
          && Boolean(surface.querySelector('.ProseMirror'));
      })()
    `),
    `Markdown surface did not become ready for ${name}`,
  );
}

async function closeWindowsAndQuit(exitCode) {
  process.exitCode = exitCode;
  const windows = BrowserWindow.getAllWindows().filter((win) => !win.isDestroyed());
  for (const win of windows) win.close();
  const closeUntil = Date.now() + 5_000;
  while (BrowserWindow.getAllWindows().some((win) => !win.isDestroyed()) && Date.now() < closeUntil) {
    await sleep(50);
  }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.destroy();
  }
  app.quit();
}

async function run() {
  const folder = path.join(smokeRoot, 'folders', 'markdown-lifecycle');
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'alpha.md'), largeNote('Alpha', 'ALPHA_UNIQUE'), 'utf8');
  fs.writeFileSync(path.join(folder, 'beta.md'), largeNote('Beta', 'BETA_UNIQUE'), 'utf8');
  for (let index = 1; index <= 6; index += 1) {
    fs.writeFileSync(path.join(folder, `retained-${index}.md`), `# Retained ${index}`, 'utf8');
  }

  const win = await waitFor(
    () => BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed()),
    'real main entry did not create its initial window',
  );
  await waitForRenderer(win);
  const origin = new URL(win.webContents.getURL()).origin;
  await win.loadURL(`${origin}/?folder=${encodeURIComponent(folder)}`);
  await waitForRenderer(win);
  await waitFor(
    () => win.webContents.executeJavaScript("document.querySelectorAll('[role=\"treeitem\"][data-path]').length >= 8"),
    'Markdown lifecycle files did not appear in the renderer',
  );

  await win.webContents.executeJavaScript(`
    (() => {
      window.__stashbaseMarkdownSmoke = { violations: [] };
      const inspect = (source) => {
        const main = document.querySelector('main.fmt-md');
        if (!main) return;
        const panel = main.querySelector('[role="tabpanel"]');
        const intentional = Array.from(panel?.querySelectorAll('[role="status"], [role="alert"]') ?? [])
          .some((element) => element.getClientRects().length > 0);
        const rendered = panel?.querySelector('[role="region"]:not([hidden]) .ProseMirror');
        if (!intentional && !rendered) {
          window.__stashbaseMarkdownSmoke.violations.push(source + ': naked active Markdown surface');
        }
      };
      window.__stashbaseMarkdownSmoke.observer = new MutationObserver(() => inspect('mutation'));
      window.__stashbaseMarkdownSmoke.observer.observe(document.querySelector('main'), {
        attributes: true,
        childList: true,
        subtree: true,
      });
      window.__stashbaseMarkdownSmoke.inspect = inspect;
    })()
  `);

  await clickFile(win, 'alpha.md');
  await waitForActiveReady(win, 'alpha.md');
  await clickFile(win, 'beta.md');
  await waitForActiveReady(win, 'beta.md');
  await waitFor(
    () => win.webContents.executeJavaScript("document.querySelectorAll('.crepe-surface[data-state=\"ready\"] .ProseMirror').length === 2"),
    'both Markdown documents were not retained',
  );

  await win.webContents.executeJavaScript(`
    (() => {
      window.__stashbaseMarkdownSmoke.alpha =
        document.querySelector('[role="region"][aria-label="alpha.md Markdown document"] .ProseMirror');
      window.__stashbaseMarkdownSmoke.beta =
        document.querySelector('[role="region"][aria-label="beta.md Markdown document"] .ProseMirror');
    })()
  `);

  fs.writeFileSync(path.join(folder, 'alpha.md'), '# Alpha externally refreshed\n\nALPHA_FRESH_ON_ACTIVATION', 'utf8');
  await clickTab(win, 'alpha.md');
  await waitForActiveReady(win, 'alpha.md');
  await waitFor(
    () => win.webContents.executeJavaScript("document.querySelector('[role=\"region\"][aria-label=\"alpha.md Markdown document\"] .ProseMirror')?.textContent.includes('ALPHA_FRESH_ON_ACTIVATION')"),
    'inactive Markdown editor did not refresh after activation',
  );
  await clickTab(win, 'beta.md');
  await waitForActiveReady(win, 'beta.md');

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
        === document.querySelector('[role="region"][aria-label="alpha.md Markdown document"] .ProseMirror'),
      beta: window.__stashbaseMarkdownSmoke.beta
        === document.querySelector('[role="region"][aria-label="beta.md Markdown document"] .ProseMirror'),
      violations: window.__stashbaseMarkdownSmoke.violations.slice(),
    }))()
  `);
  assert.equal(retention.alpha, true, 'alpha editor DOM identity changed across tab switches');
  assert.equal(retention.beta, true, 'beta editor DOM identity changed across tab switches');
  assert.deepEqual(retention.violations, []);

  await clickButton(win, 'Switch to Reading View');
  await waitFor(
    () => win.webContents.executeJavaScript("document.querySelector('[role=\"region\"][aria-label=\"beta.md Markdown document\"] .crepe-shell')?.classList.contains('crepe-readonly')"),
    'Reading View did not activate',
  );
  await clickButton(win, 'Switch to Live Editing');
  await waitFor(
    () => win.webContents.executeJavaScript("!document.querySelector('[role=\"region\"][aria-label=\"beta.md Markdown document\"] .crepe-shell')?.classList.contains('crepe-readonly')"),
    'Live Editing did not reactivate',
  );
  assert.equal(
    await win.webContents.executeJavaScript(`window.__stashbaseMarkdownSmoke.beta
      === document.querySelector('[role="region"][aria-label="beta.md Markdown document"] .ProseMirror')`),
    true,
    'mode switching replaced the retained editor DOM',
  );

  await win.webContents.executeJavaScript(`
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'f',
      ${process.platform === 'darwin' ? 'metaKey: true' : 'ctrlKey: true'},
      bubbles: true,
      cancelable: true,
    }))
  `);
  await waitFor(
    () => win.webContents.executeJavaScript("Boolean(document.querySelector('[role=\"search\"][aria-label=\"Find in document\"] input[placeholder=\"Find\"]'))"),
    'Find did not open for the active Markdown surface',
  );
  await win.webContents.executeJavaScript(`
    (() => {
      const input = document.querySelector('[role="search"][aria-label="Find in document"] input[placeholder="Find"]');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'BETA_UNIQUE');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()
  `);
  await waitFor(
    () => win.webContents.executeJavaScript("/[1-9][0-9]*\\/[1-9][0-9]*/.test(document.querySelector('[role=\"search\"][aria-label=\"Find in document\"]')?.textContent ?? '')"),
    'active beta Find controller did not report matches',
  );
  await clickTab(win, 'alpha.md');
  await waitForActiveReady(win, 'alpha.md');
  await waitFor(
    () => win.webContents.executeJavaScript("document.querySelector('[role=\"search\"][aria-label=\"Find in document\"]')?.textContent.includes('0/0')"),
    'inactive beta Find controller remained registered',
  );

  await clickTabClose(win, 'beta.md');
  await waitFor(
    () => win.webContents.executeJavaScript("!document.querySelector('[role=\"region\"][aria-label=\"beta.md Markdown document\"]')"),
    'closed Markdown editor was not destroyed',
  );
  assert.equal(
    await win.webContents.executeJavaScript('window.__stashbaseMarkdownSmoke.alpha.isConnected'),
    true,
    'closing another tab destroyed the retained alpha editor',
  );

  for (let index = 1; index <= 6; index += 1) {
    await clickFile(win, `retained-${index}.md`);
    await waitForActiveReady(win, `retained-${index}.md`);
  }
  assert.equal(
    await win.webContents.executeJavaScript("document.querySelectorAll('.crepe-surface').length"),
    5,
    'retained Markdown editor cache exceeded its MRU bound',
  );
  await clickTab(win, 'retained-1.md');
  await waitForActiveReady(win, 'retained-1.md');
  assert.equal(
    await win.webContents.executeJavaScript("document.querySelectorAll('.crepe-surface').length"),
    5,
    'reopening an evicted Markdown tab did not preserve the MRU bound',
  );

  await win.webContents.executeJavaScript('window.__stashbaseMarkdownSmoke.observer.disconnect()');
  clearTimeout(deadline);
  console.log('real Markdown tab lifecycle smoke passed');
  await closeWindowsAndQuit(0);
}

require('./main.cjs');
app.whenReady()
  .then(run)
  .catch(async (err) => {
    clearTimeout(deadline);
    console.error(err);
    await closeWindowsAndQuit(1);
  });
