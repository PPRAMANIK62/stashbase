/**
 * Electron main process for StashBase.
 *
 * Boots the Express server as a child process and serves the application UI
 * from its privileged app:// origin. Explicit Vite development keeps using
 * the loopback development origin. Quitting the app kills the server.
 *
 * The renderer is sandboxed; replacement capabilities cross only through the
 * bundled, typed preload bridge.
 */

const { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, net, protocol, safeStorage, session, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const {
  createServerArguments,
  createServerChildEnvironment,
  isCompatibleServerHealth,
  serverStartupTimeoutMs,
  waitForStableServerProbe,
} = require('./main-probe.cjs');
const { shouldOfferClipboardImage } = require('./clipboard-watch-policy.cjs');
const { createRecoveryKeyProvider } = require('./recovery-key.cjs');
const { createBugReportService } = require('./bug-report-service.cjs');
const { collectBugReportDiagnostics } = require('./bug-report-diagnostics.cjs');
const { collectRedactedApplicationLog, readApplicationLogTail } = require('./bug-report-log.cjs');
const { captureWindowScreenshot } = require('./bug-report-screenshot.cjs');
const { createBugReportHandoff } = require('./bug-report-handoff.cjs');
const { createBugReportReviewWindow } = require('./bug-report-review-window.cjs');
const { createUpdateInstaller } = require('./update-install-strategy.cjs');
const { createUpdateManager } = require('./update-manager.cjs');
const {
  APP_ORIGIN,
  APP_URL,
  installAppProtocol,
  registerAppScheme,
} = require('./app-protocol.cjs');
const {
  applicationWindowWebPreferences,
  isAllowedApplicationUrl,
  secureApplicationWindow,
} = require('./window-security.cjs');
const { installRequestAuthorization } = require('./renderer/requests.cjs');
const {
  applicationWindowChromeOptions,
  classifyProtocolLaunch,
  createApplicationMenuTemplate,
  createSingleFlight,
  createWindowRegistry,
  focusWindow,
  isOAuthReturnUrl,
  isStashBaseProtocolUrl,
  releaseWindowContextWithRetry,
  shouldQuitAfterLastWindow,
  windowLifecycleShortcutAction,
} = require('./multi-window.cjs');

registerAppScheme(protocol);

function parsePortArg(argv, fallback) {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--port=')) return Number(a.slice(7)) || fallback;
    if (a === '--port') return Number(argv[i + 1]) || fallback;
  }
  return fallback;
}
const SERVER_PORT = parsePortArg(process.argv.slice(1), 8090);

function pythonCandidates(root) {
  return process.platform === 'win32'
    ? [
      path.join(root, 'Scripts', 'python.exe'),
      path.join(root, 'bin', 'python'),
    ]
    : [
      path.join(root, 'bin', 'python'),
      path.join(root, 'Scripts', 'python.exe'),
    ];
}

function sidecarExecutable(root, name, opts = {}) {
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  return opts.direct ? path.join(root, exe) : path.join(root, name, exe);
}

function statIsFile(file) {
  try { return fs.statSync(file).isFile(); } catch { return false; }
}

let serverLogPath = null;

function getServerLogPath() {
  if (serverLogPath) return serverLogPath;
  try {
    // Electron chooses the platform-correct application log directory. This
    // must not fall back to a handwritten macOS-only location.
    app.setAppLogsPath();
    const logDir = app.getPath('logs');
    if (typeof logDir !== 'string' || !logDir) return null;
    serverLogPath = path.join(logDir, 'server.log');
    return serverLogPath;
  } catch {
    return null;
  }
}

function appendServerLogHint(message) {
  const logPath = getServerLogPath();
  const tail = logPath ? readApplicationLogTail({ filePath: logPath, maxBytes: 5000 }) : null;
  return tail?.text
    ? `${message}\n\nRecent server log:\n${tail.text}`
    : message;
}

function stopSpawnedServer() {
  const proc = serverProc;
  if (!proc || proc.exitCode != null || proc.signalCode != null) return;
  try { proc.kill('SIGTERM'); } catch { /* already gone */ }
  setTimeout(() => {
    if (proc.exitCode == null && proc.signalCode == null) {
      try { proc.kill('SIGKILL'); } catch { /* already gone */ }
    }
  }, 1500).unref();
}

// Use the IPv4 loopback address explicitly. The server binds to
// 127.0.0.1, and `localhost` may resolve to ::1 first on dual-stack
// systems — pointing the renderer at 127.0.0.1 sidesteps the silent
// "can't connect" race.
const SERVER_HOST = '127.0.0.1';
const SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;
const USE_DEV_VITE = !app.isPackaged && process.env.STASHBASE_DEV_VITE === '1';
const RENDERER_ORIGIN = USE_DEV_VITE ? SERVER_URL : APP_ORIGIN;
const SERVER_PROTOCOL_VERSION = 1;
const SERVER_SHUTDOWN_TOKEN = crypto.randomBytes(32).toString('hex');
const OAUTH_RETURN_TOKEN = crypto.randomBytes(32).toString('hex');
const PROJECT_ROOT = app.isPackaged ? app.getAppPath() : path.resolve(__dirname, '..');
const SERVER_ENTRY = app.isPackaged
  ? path.join(PROJECT_ROOT, 'dist', 'server', 'index.mjs')
  : path.join(PROJECT_ROOT, 'server', 'index.ts');
const MCP_ENTRY = app.isPackaged
  ? path.join(PROJECT_ROOT, 'dist', 'mcp', 'server.mjs')
  : path.join(PROJECT_ROOT, 'mcp', 'server.ts');
const RESOURCES_ROOT = app.isPackaged ? process.resourcesPath : PROJECT_ROOT;

let serverProc = null;
let serverStartPromise = null;
const mainWindows = new Set();
const bugReportReviewWindows = new Set();
const bugReportReviewDraftBySender = new Map();
const windowRegistry = createWindowRegistry({ platform: process.platform });
const replacementWindowCapabilities = new WeakMap();
let libraryFolderDialogCapability = null;
let libraryLifecycleCapability = null;
let workspaceSessionCapability = null;
let windowLifecycleCapability = null;
let externalNavigationCapability = null;
let captureCapability = null;
let bugReportCapability = null;
let captureMonitor = null;
let replacementWindowLifecycle = null;
let workspaceSessionRestoreWindow = null;
let replacementBoundaryInstalled = false;

const BUG_REPORT_REVIEW_FILE_URL = pathToFileURL(
  path.join(__dirname, 'bug-report-review.html'),
).toString();

function isBugReportReviewFrameUrl(url) {
  if (typeof url !== 'string') return false;
  if (url === BUG_REPORT_REVIEW_FILE_URL || url.startsWith(`${BUG_REPORT_REVIEW_FILE_URL}#`)) {
    return true;
  }
  return !USE_DEV_VITE && isAllowedApplicationUrl(url, APP_ORIGIN);
}

function installReplacementBoundary() {
  if (replacementBoundaryInstalled) return;
  installAppProtocol({
    protocol,
    net,
    rendererRoot: path.join(PROJECT_ROOT, 'dist', 'renderer'),
    serverOrigin: SERVER_URL,
  });
  const boundary = require(path.join(
    PROJECT_ROOT,
    'dist',
    'electron',
    'library',
    'dialog.cjs',
  ));
  const externalNavigation = require(path.join(
    PROJECT_ROOT,
    'dist',
    'electron',
    'external-navigation',
    'handler.cjs',
  ));
  const lifecycle = require(path.join(
    PROJECT_ROOT,
    'dist',
    'electron',
    'library',
    'lifecycle.cjs',
  ));
  const workspaceSession = require(path.join(
    PROJECT_ROOT,
    'dist',
    'electron',
    'workspace',
    'session.cjs',
  ));
  const windowLifecycle = require(path.join(
    PROJECT_ROOT,
    'dist',
    'electron',
    'window',
    'lifecycle.cjs',
  ));
  const capture = require(path.join(
    PROJECT_ROOT,
    'dist',
    'electron',
    'capture',
    'monitor.cjs',
  ));
  const bugReportOpen = require(path.join(
    PROJECT_ROOT,
    'dist',
    'electron',
    'bug-report',
    'open.cjs',
  ));
  const bugReportReview = require(path.join(
    PROJECT_ROOT,
    'dist',
    'electron',
    'bug-report',
    'review-ipc.cjs',
  ));
  libraryFolderDialogCapability = boundary.LIBRARY_FOLDER_DIALOG_CAPABILITY;
  libraryLifecycleCapability = lifecycle.LIBRARY_LIFECYCLE_CAPABILITY;
  workspaceSessionCapability = workspaceSession.WORKSPACE_SESSION_CAPABILITY;
  windowLifecycleCapability = windowLifecycle.WINDOW_LIFECYCLE_CAPABILITY;
  externalNavigationCapability = externalNavigation.EXTERNAL_NAVIGATION_CAPABILITY;
  captureCapability = capture.CAPTURE_CAPABILITY;
  bugReportCapability = bugReportOpen.BUG_REPORT_CAPABILITY;
  bugReportOpen.registerBugReportOpen({
    BrowserWindow,
    ipcMain,
    expectedOrigins: new Set([RENDERER_ORIGIN]),
    isLiveWindow: (win) => isLiveMainWindow(win),
    hasCapability: (win, capability) => (
      replacementWindowCapabilities.get(win)?.has(capability) === true
    ),
    openReview: (win) => openBugReportReview(win),
  });
  bugReportReview.registerBugReportReviewIpc({
    ipcMain,
    bugReports,
    draftIdForSender: (senderWebContentsId) => (
      bugReportReviewDraftBySender.get(senderWebContentsId) ?? null
    ),
    prepareApprovedReport: (snapshot) => bugReportHandoff.prepare(snapshot),
    openPreparedReport: (snapshot) => bugReportHandoff.openGitHub(snapshot),
    savePreparedReport: (snapshot) => bugReportHandoff.saveToDownloads(snapshot),
    isReviewFrameUrl: (url) => isBugReportReviewFrameUrl(url),
  });
  // Clipboard-image offers fail closed: main re-reads the durable Settings
  // opt-in from the server on every refresh and never enables from memory.
  captureMonitor = capture.registerCaptureMonitor({
    BrowserWindow,
    clipboard,
    ipcMain,
    expectedOrigins: new Set([RENDERER_ORIGIN]),
    focusedWindow: () => BrowserWindow.getFocusedWindow(),
    isLiveWindow: (win) => isLiveMainWindow(win),
    hasCapability: (win, capability) => (
      replacementWindowCapabilities.get(win)?.has(capability) === true
    ),
    readPreference: async () => {
      const response = await fetch(`${SERVER_URL}/api/capture`);
      if (!response.ok) return false;
      const preferences = await response.json();
      return preferences?.clipboardImageImport === true;
    },
    shouldOffer: shouldOfferClipboardImage,
  });
  externalNavigation.registerExternalNavigation({
    BrowserWindow,
    ipcMain,
    expectedOrigins: new Set([RENDERER_ORIGIN]),
    isLiveWindow: (win) => isLiveMainWindow(win),
    hasCapability: (win, capability) => (
      replacementWindowCapabilities.get(win)?.has(capability) === true
    ),
    openExternal: (url) => shell.openExternal(url),
  });
  boundary.registerDialog({
    BrowserWindow,
    dialog,
    ipcMain,
    expectedOrigins: new Set([RENDERER_ORIGIN]),
    isLiveWindow: (win) => isLiveMainWindow(win),
    hasCapability: (win, capability) => (
      replacementWindowCapabilities.get(win)?.has(capability) === true
    ),
  });
  lifecycle.registerLifecycle({
    BrowserWindow,
    ipcMain,
    expectedOrigins: new Set([RENDERER_ORIGIN]),
    isLiveWindow: (win) => isLiveMainWindow(win),
    hasCapability: (win, capability) => (
      replacementWindowCapabilities.get(win)?.has(capability) === true
    ),
    liveWindows: () => [...mainWindows].filter((win) => isLiveMainWindow(win)),
    setActiveFolder: (win, folder) => {
      const windowId = windowRegistry.idForWindow(win);
      return windowId ? windowRegistry.setFolder(windowId, folder) : false;
    },
    windowsForFolder: (folder) => windowRegistry
      .windowsByFolder(folder)
      .filter((win) => isLiveMainWindow(win)),
  });
  workspaceSession.registerWorkspaceSession({
    BrowserWindow,
    ipcMain,
    expectedOrigins: new Set([RENDERER_ORIGIN]),
    isLiveWindow: (win) => isLiveMainWindow(win),
    hasCapability: (win, capability) => (
      replacementWindowCapabilities.get(win)?.has(capability) === true
    ),
    claimRestore: (win) => win === workspaceSessionRestoreWindow,
    store: workspaceSession.createWorkspaceSessionStore({
      filePath: path.join(app.getPath('userData'), 'workspace-session.json'),
    }),
  });
  replacementWindowLifecycle = windowLifecycle.registerWindowLifecycle({
    BrowserWindow,
    ipcMain,
    expectedOrigins: new Set([RENDERER_ORIGIN]),
    isLiveWindow: (win) => isLiveMainWindow(win),
    hasCapability: (win, capability) => (
      replacementWindowCapabilities.get(win)?.has(capability) === true
    ),
  });
  replacementBoundaryInstalled = true;
}
let lastMainWindow = null;

async function readAutoUpdatePreference() {
  const response = await fetch(`${SERVER_URL}/api/updates/preferences`);
  if (!response.ok) throw new Error(`Update preferences returned HTTP ${response.status}`);
  const preferences = await response.json();
  return preferences?.autoCheck === true;
}

const installDesktopUpdate = createUpdateInstaller({
  updater: autoUpdater,
  app,
  platform: process.platform,
  appImagePath: process.env.APPIMAGE || null,
  fileExists: fs.existsSync,
});

const desktopUpdates = createUpdateManager({
  updater: autoUpdater,
  currentVersion: app.getVersion(),
  platform: process.platform,
  isPackaged: app.isPackaged,
  readAutoCheck: readAutoUpdatePreference,
  // The current replacement workspace has no editable documents. The
  // document slice will reconnect update installation to a typed save
  // capability when unsaved state exists again.
  beforeInstall: async () => true,
  installUpdate: installDesktopUpdate,
  openReleasePage: (url) => openHttpExternal(url, 'update release URL'),
  debugEnabled: !app.isPackaged,
});
const bugReports = createBugReportService({
  captureScreenshot: async ({ webContentsId }) => {
    const sourceWindow = [...mainWindows].find((win) => (
      isLiveMainWindow(win) && win.webContents.id === webContentsId
    ));
    return sourceWindow ? captureWindowScreenshot(sourceWindow.webContents) : null;
  },
  collectDiagnostics: () => collectBugReportDiagnostics({ app }),
  collectLog: () => {
    const logPath = getServerLogPath();
    return logPath ? collectRedactedApplicationLog({ filePath: logPath }) : null;
  },
});
const bugReportHandoff = createBugReportHandoff({
  baseTemporaryDirectory: path.join(app.getPath('temp'), 'stashbase', 'bug-reports'),
  downloadsDirectory: async () => app.getPath('downloads'),
  openExternal: (url) => shell.openExternal(url),
});

const APP_CONFIG_FILE = path.join(os.homedir(), '.stashbase', 'config.json');

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function cmdQuote(value) {
  return `"${cmdValue(value).replace(/"/g, '""')}"`;
}

function cmdValue(value) {
  return String(value).replace(/%/g, '%%');
}

function localBin(name) {
  return path.join(PROJECT_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name);
}

function needsCmdShell(command) {
  return process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
}

function mcpWrapperPath() {
  return path.join(
    os.homedir(),
    '.stashbase',
    'bin',
    process.platform === 'win32' ? 'stashbase-mcp.cmd' : 'stashbase-mcp',
  );
}

function readJsonObject(file) {
  if (!fs.existsSync(file)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    console.warn(`[electron] ${file} is not a JSON object; leaving untouched`);
  } catch (err) {
    console.warn(`[electron] couldn't parse ${file}: ${err.message}; leaving untouched`);
  }
  return null;
}

function readAppConfig() {
  const cfg = readJsonObject(APP_CONFIG_FILE);
  return cfg && typeof cfg === 'object' ? cfg : {};
}

function writeAppConfig(cfg) {
  writeFileAtomic(APP_CONFIG_FILE, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
}

function writeMcpWrapper() {
  const wrapper = mcpWrapperPath();
  const resourcesPath = RESOURCES_ROOT;
  const content = process.platform === 'win32'
    ? [
      '@echo off',
      `set "STASHBASE_APP_ROOT=${cmdValue(PROJECT_ROOT)}"`,
      `set "STASHBASE_RESOURCES_PATH=${cmdValue(resourcesPath)}"`,
      ...(app.isPackaged
        ? [
          'set "ELECTRON_RUN_AS_NODE=1"',
          `${cmdQuote(process.execPath)} ${cmdQuote(MCP_ENTRY)} %*`,
        ]
        : [
          `${cmdQuote(localBin('tsx'))} ${cmdQuote(MCP_ENTRY)} %*`,
        ]),
      '',
    ].join('\r\n')
    : [
      '#!/bin/sh',
      'set -eu',
      `export STASHBASE_APP_ROOT=${shellQuote(PROJECT_ROOT)}`,
      `export STASHBASE_RESOURCES_PATH=${shellQuote(resourcesPath)}`,
      ...(app.isPackaged
        ? [
          'export ELECTRON_RUN_AS_NODE=1',
          `exec ${shellQuote(process.execPath)} ${shellQuote(MCP_ENTRY)} "$@"`,
        ]
        : [
          `exec ${shellQuote(localBin('tsx'))} ${shellQuote(MCP_ENTRY)} "$@"`,
        ]),
      '',
    ].join('\n');
  writeFileAtomic(wrapper, content, { mode: 0o755 });
  return wrapper;
}

function writeFileAtomic(file, content, options = {}) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const nonce = Math.random().toString(36).slice(2);
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now()}.${nonce}.tmp`);
  try {
    fs.writeFileSync(tmp, content, options);
    fs.renameSync(tmp, file);
    if (typeof options.mode === 'number') {
      try { fs.chmodSync(file, options.mode); } catch { /* best-effort */ }
    }
  } catch (err) {
    try { fs.rmSync(tmp, { force: true }); } catch { /* best-effort */ }
    throw err;
  }
}

/** Spawn the Express server as a child. If something else is already on
 *  the port (e.g. you've got `pnpm dev` running in a terminal), we
 *  skip the spawn and just point the window at it — handy for editing
 *  the server in your editor with tsx-watch hot reload. */
async function startOrReuseServer() {
  const existing = await waitForStableServerProbe(
    () => probeServer(SERVER_PORT, 300),
    { timeoutMs: 5_000, retryMs: 150 },
  );
  if (existing.compatible) {
    if (!app.isPackaged) {
      console.log(`[electron] reusing existing server at ${SERVER_URL}`);
      return;
    }
    // Packaged builds never adopt. The single-instance lock means a live
    // sibling Electron cannot exist, so a compatible listener is an orphan
    // from a dead owner (or a manually launched server). Adopting it strands
    // shutdown — its shutdown token belongs to the dead parent and
    // `will-quit` only kills a child we spawned — so the server would
    // outlive every future session. Spawn our own child instead: on
    // EADDRINUSE it reclaims a verified orphaned sibling and rebinds, or
    // exits with the port guidance when the holder has a live parent.
    console.warn(`[electron] found an unowned StashBase server on ${SERVER_URL} — spawning an owned replacement`);
  } else if (existing.occupied) {
    const what = existing.legacyStashBase
      ? 'an older StashBase server'
      : 'another local service';
    throw new Error(
      `Port ${SERVER_PORT} is already in use by ${what}, so this StashBase build cannot start its server.\n` +
      `Quit the other StashBase/app using ${SERVER_URL}, then reopen StashBase.`,
    );
  }
  const serverBin = app.isPackaged
    ? process.execPath
    : localBin('tsx');
  // `watch` mode in dev so server-side edits hot-reload without a full
  // app restart. Packaged builds run the pre-bundled Node entry through
  // Electron's embedded Node runtime. `--port=N` is appended only when
  // overriding the default so the server's argv parser sees the standard
  // CLI flag (matches the `npm start -- --port=...` workflow).
  const portArgs = SERVER_PORT === 8090 ? [] : [`--port=${SERVER_PORT}`];
  const serverArgs = createServerArguments({
    entry: SERVER_ENTRY,
    portArgs,
    packaged: app.isPackaged,
    vite: process.env.STASHBASE_DEV_VITE === '1',
  });
  // In packaged builds the Python sidecar lives under
  // `process.resourcesPath` (electron-builder `extraResources`). In dev
  // tsx finds python via the local venv, so we only override when
  // packaged. Model weights are cached by huggingface_hub under
  // `~/.cache/huggingface/` regardless of dev vs packaged.
  const packagedPythonCandidates = [
    ...pythonCandidates(path.join(RESOURCES_ROOT, 'python', 'runtime')),
    ...pythonCandidates(path.join(RESOURCES_ROOT, 'python', '.venv')),
  ];
  const packagedPython = packagedPythonCandidates.find((candidate) => {
    try { return require('node:fs').existsSync(candidate); } catch { return false; }
  });
  // PyInstaller --onedir lays out the bundle as
  // `sidecar/stashbase-daemon/stashbase-daemon` (outer name = dir,
  // inner name = executable). The --onefile layout used to put the
  // executable directly at `sidecar/stashbase-daemon`, so check both
  // for forward compat with anyone still on the old layout, and stat
  // each candidate as a *file* — spawn-ing the outer directory by
  // mistake yields EACCES with no useful hint.
  const packagedDaemonCandidates = [
    sidecarExecutable(path.join(RESOURCES_ROOT, 'python', 'sidecar'), 'stashbase-daemon'),
    sidecarExecutable(path.join(RESOURCES_ROOT, 'python', 'sidecar'), 'stashbase-daemon', { direct: true }),
  ];
  const packagedDaemon = packagedDaemonCandidates.find((candidate) => {
    return statIsFile(candidate);
  });
  const hasPackagedDaemon = Boolean(packagedDaemon);
  // The PDF / OCR extractors ship as a second PyInstaller --onedir bundle
  // (`sidecar/stashbase-extract/stashbase-extract`) so the packaged app can
  // run them without a Python interpreter — there's no bundled venv. The
  // server (pdf.ts / image.ts) spawns this binary with a `pdf` / `ocr`
  // subcommand when STASHBASE_EXTRACT_BIN is set; in dev it spawns the
  // scripts via the local venv instead.
  const packagedExtractCandidates = [
    sidecarExecutable(path.join(RESOURCES_ROOT, 'python', 'sidecar'), 'stashbase-extract'),
    sidecarExecutable(path.join(RESOURCES_ROOT, 'python', 'sidecar'), 'stashbase-extract', { direct: true }),
  ];
  const packagedExtract = packagedExtractCandidates.find((candidate) => {
    return statIsFile(candidate);
  });
  const hasPackagedExtract = Boolean(packagedExtract);
  const packagedDaemonScript = path.join(RESOURCES_ROOT, 'python', 'stashbase_daemon.py');
  const packagedPdfScript = path.join(RESOURCES_ROOT, 'python', 'pdf_extract.py');
  const packagedOcrScript = path.join(RESOURCES_ROOT, 'python', 'ocr_extract.py');
  if (app.isPackaged) {
    if (!statIsFile(SERVER_ENTRY)) {
      throw new Error(`Packaged server entry is missing: ${SERVER_ENTRY}`);
    }
    if (!hasPackagedDaemon && !(packagedPython && statIsFile(packagedDaemonScript))) {
      throw new Error(
        'Packaged Python daemon is missing. Rebuild with `pnpm build:python-sidecar` and package again.\n' +
        `Looked for: ${packagedDaemonCandidates.join(', ')}\n` +
        `Fallback script: ${packagedDaemonScript}`,
      );
    }
  }
  const packagedEnv = app.isPackaged
    ? {
      ELECTRON_RUN_AS_NODE: '1',
      STASHBASE_APP_ROOT: PROJECT_ROOT,
      STASHBASE_RESOURCES_PATH: RESOURCES_ROOT,
      ...(hasPackagedDaemon ? { STASHBASE_DAEMON_BIN: packagedDaemon } : {}),
      ...(hasPackagedExtract ? { STASHBASE_EXTRACT_BIN: packagedExtract } : {}),
      ...(packagedPython ? { STASHBASE_PYTHON: packagedPython } : {}),
    }
    : { STASHBASE_APP_ROOT: PROJECT_ROOT };
  // In packaged+asar mode PROJECT_ROOT is `.../Resources/app.asar` —
  // a FILE, not a directory. spawn(cwd) hits the OS syscall (no
  // electron asar shim) and bails with ENOTDIR. Use the real
  // Resources/ directory there; in dev keep PROJECT_ROOT (the repo).
  const serverCwd = app.isPackaged ? RESOURCES_ROOT : PROJECT_ROOT;
  // Tee server output to a per-launch log file in ~/Library/Logs/StashBase/
  // so a packaged Dock launch is debuggable, AND to the parent stdio so
  // `pnpm electron` from a terminal still shows live logs. The file is
  // truncated each launch — old crashes would only confuse the user.
  const currentServerLogPath = getServerLogPath();
  let logFd = null;
  if (currentServerLogPath) {
    try {
      fs.mkdirSync(path.dirname(currentServerLogPath), { recursive: true });
      logFd = fs.openSync(currentServerLogPath, 'w');
      fs.writeSync(
        logFd,
        `--- StashBase server launch ${new Date().toISOString()} (pid=${process.pid}, packaged=${app.isPackaged}) ---\n`,
      );
      fs.writeSync(logFd, `server entry: ${SERVER_ENTRY}\n`);
      fs.writeSync(logFd, `server cwd: ${serverCwd}\n`);
      if (app.isPackaged) {
        fs.writeSync(logFd, `resources: ${RESOURCES_ROOT}\n`);
        fs.writeSync(logFd, `daemon: ${packagedDaemon || '(missing; using Python script fallback if available)'}\n`);
        fs.writeSync(logFd, `extractor: ${packagedExtract || '(missing; using Python script fallback if available)'}\n`);
        fs.writeSync(logFd, `python: ${packagedPython || '(missing)'}\n`);
        if (!hasPackagedExtract && !(packagedPython && statIsFile(packagedPdfScript) && statIsFile(packagedOcrScript))) {
          fs.writeSync(
            logFd,
            'warning: packaged extractor resources are missing; PDF/image text extraction will fail until the package is rebuilt\n',
          );
        }
      }
    } catch (err) {
      console.warn(`[electron] application log unavailable: ${err?.message ?? err}`);
      if (logFd !== null) {
        try { fs.closeSync(logFd); } catch { /* nothing left to close */ }
      }
      logFd = null;
    }
  }
  const recoveryJournalKey = createRecoveryKeyProvider({
    safeStorage,
    filePath: path.join(app.getPath('userData'), 'recovery-journal.key'),
  }).load();
  if (recoveryJournalKey === null) {
    console.warn('[electron] recovery journal disabled: OS-protected storage is unavailable');
  }
  serverProc = spawn(serverBin, serverArgs, {
    cwd: serverCwd,
    // Port flows via the CLI arg above, not the env — keeps the server
    // entry's argv parser the single source of truth for port config.
    env: createServerChildEnvironment({
      baseEnv: process.env,
      packaged: app.isPackaged,
      packagedEnv,
      shutdownToken: SERVER_SHUTDOWN_TOKEN,
      oauthReturnToken: OAUTH_RETURN_TOKEN,
      recoveryJournalKey,
    }),
    // stdin = 'ignore' is intentional: the server never reads from
    // stdin, and inheriting the parent's TTY made Node attach a real
    // TTY ReadStream to the child's fd 0. Any flake on that TTY
    // (shell repaint, tmux/screen detach, Ctrl-Z, terminal closed
    // while the app was still running) emitted an `EIO` on the
    // unread stream which had no listener → unhandled 'error'
    // event, killed the whole electron process. Closing stdin
    // entirely sidesteps the class of bug.
    // Logging is optional: an unavailable log directory must not prevent
    // StashBase from starting. Bug-report collection only reads the
    // Electron-managed file, never an arbitrary renderer-provided path.
    stdio: logFd === null ? ['ignore', 'inherit', 'inherit'] : ['ignore', logFd, logFd],
    shell: needsCmdShell(serverBin),
  });
  if (logFd !== null) {
    try { fs.closeSync(logFd); } catch { /* child owns its duplicate */ }
  }
  // `spawn` can fail asynchronously (ENOENT when tsx isn't installed,
  // permission errors, etc.). Without an explicit listener Node treats
  // the 'error' event as fatal and the whole Electron process crashes
  // with an unhelpful stack — surface a useful message instead.
  let serverSpawnError = null;
  serverProc.on('error', (err) => {
    serverSpawnError = err;
    console.warn(`[electron] server spawn failed: ${err.message}`);
    if (err.code === 'ENOENT') {
      console.warn(`[electron]   couldn't find ${serverBin}. ` +
        `Run \`pnpm install\` to populate node_modules/.bin.`);
    }
  });
  serverProc.on('exit', (code) => {
    serverStartPromise = null;
    if (code != null && code !== 0) {
      console.warn(`[electron] server exited with code ${code}`);
    }
  });
  // Poll until the server is up. Packaged code is already bundled; source
  // launches compile TypeScript on demand and need a wider cold-start bound
  // on contended developer and CI machines. Both paths still fail closed.
  const startupTimeoutMs = serverStartupTimeoutMs({ packaged: app.isPackaged });
  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    if (serverSpawnError) {
      throw new Error(appendServerLogHint(`server spawn failed: ${serverSpawnError.message}`));
    }
    if ((await probeServer(SERVER_PORT, 200)).compatible) return;
    if (serverProc.exitCode != null || serverProc.signalCode != null) {
      const detail = serverProc.exitCode != null
        ? `server exited with code ${serverProc.exitCode}`
        : `server exited with signal ${serverProc.signalCode}`;
      throw new Error(appendServerLogHint(`${detail} before reporting healthy on :${SERVER_PORT}`));
    }
    await sleep(150);
  }
  stopSpawnedServer();
  throw new Error(appendServerLogHint(
    `server did not come up on :${SERVER_PORT} within ${startupTimeoutMs / 1000}s`,
  ));
}

/** Coalesce every window onto one server readiness promise. The spawned
 *  server's exit listener clears the latch; a reused development server is
 *  assumed to remain the renderer owner for this Electron session. */
async function ensureServer() {
  if (!serverStartPromise) serverStartPromise = startOrReuseServer();
  const pending = serverStartPromise;
  try {
    await pending;
  } catch (err) {
    // A failed older startup must not clear a newer retry installed after
    // its child process exited.
    if (serverStartPromise === pending) serverStartPromise = null;
    throw err;
  }
}

async function probeServer(port, timeoutMs) {
  const health = await requestJson(port, '/api/health', timeoutMs);
  if (!health.reachable) {
    return {
      compatible: false,
      occupied: health.connected,
      legacyStashBase: false,
      transient: health.connected,
    };
  }
  if (
    health.statusCode === 200 &&
    isCompatibleServerHealth(health.body, {
      protocolVersion: SERVER_PROTOCOL_VERSION,
      appRoot: PROJECT_ROOT,
      resourcesPath: RESOURCES_ROOT,
    })
  ) {
    return { compatible: true, occupied: true, legacyStashBase: false, transient: false };
  }

  const folder = await requestJson(port, '/api/folder', timeoutMs);
  const legacyStashBase =
    folder.statusCode === 200 &&
    folder.body &&
    typeof folder.body === 'object' &&
    ('current' in folder.body || 'recent' in folder.body) &&
    'homeDir' in folder.body;
  return { compatible: false, occupied: true, legacyStashBase, transient: false };
}

function requestJson(port, requestPath, timeoutMs, options = {}) {
  return new Promise((resolve) => {
    let connected = false;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve({ ...result, connected });
    };
    const req = http.request(
      {
        host: SERVER_HOST,
        port,
        path: requestPath,
        method: options.method || 'GET',
        headers: options.headers,
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          if (body.length < 4096) body += chunk;
        });
        res.on('end', () => {
          try {
            finish({ reachable: true, statusCode: res.statusCode ?? 0, body: JSON.parse(body) });
          } catch {
            finish({ reachable: true, statusCode: res.statusCode ?? 0, body: null });
          }
        });
      },
    );
    req.on('socket', (socket) => {
      if (!socket.connecting) connected = true;
      else socket.once('connect', () => { connected = true; });
    });
    req.on('error', () => finish({ reachable: false, statusCode: 0, body: null }));
    req.on('timeout', () => {
      req.destroy();
      finish({ reachable: false, statusCode: 0, body: null });
    });
    req.end();
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function isHttpUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function openExternalUnchecked(rawUrl, label = 'external URL') {
  try {
    await shell.openExternal(rawUrl);
    return { ok: true };
  } catch (err) {
    const message = err && typeof err.message === 'string' ? err.message : String(err);
    console.warn(`[electron] failed to open ${label}: ${message}`);
    return { ok: false, error: message };
  }
}

async function openHttpExternal(rawUrl, label = 'external URL') {
  if (typeof rawUrl !== 'string' || !isHttpUrl(rawUrl)) return false;
  const result = await openExternalUnchecked(rawUrl, label);
  return result.ok;
}

function isLiveMainWindow(win) {
  return !!(win && mainWindows.has(win) && !win.isDestroyed());
}

function bugReportSourceForWindow(win) {
  if (!isLiveMainWindow(win)) return null;
  const windowId = windowRegistry.idForWindow(win);
  const webContentsId = win.webContents?.id;
  if (!windowId || !Number.isSafeInteger(webContentsId) || webContentsId <= 0) return null;
  return { windowId, webContentsId };
}

async function showBugReportError(win, message) {
  const options = {
    type: 'error',
    title: 'Report a Bug',
    message,
  };
  try {
    if (isLiveMainWindow(win)) await dialog.showMessageBox(win, options);
    else await dialog.showMessageBox(options);
  } catch {
    // A native error dialog is best effort and must not affect cleanup.
  }
}

async function openBugReportReview(win) {
  const source = bugReportSourceForWindow(win);
  if (!source) {
    await showBugReportError(win, 'StashBase could not start a bug report for this window.');
    return;
  }
  const created = await bugReports.createDraft(source);
  if (!created.ok) {
    await showBugReportError(win, 'StashBase could not start a bug report.');
    return;
  }

  let review;
  try {
    review = createBugReportReviewWindow({
      BrowserWindow,
      sourceWindow: isLiveMainWindow(win) ? win : null,
      ...(USE_DEV_VITE
        ? {
          preloadPath: path.join(__dirname, 'bug-report-review-preload.cjs'),
          htmlPath: path.join(__dirname, 'bug-report-review.html'),
        }
        : {
          preloadPath: path.join(
            PROJECT_ROOT,
            'dist',
            'electron',
            'bug-report',
            'review-window-preload.cjs',
          ),
          appUrl: `${APP_URL}bug-report.html`,
        }),
    });
  } catch {
    bugReports.discardDraft(created.draft.id, source.webContentsId);
    await showBugReportError(win, 'StashBase could not open the bug report review.');
    return;
  }

  const reviewWindow = review.window;
  const reviewWebContentsId = reviewWindow.webContents.id;
  bugReportReviewWindows.add(reviewWindow);
  bugReportReviewDraftBySender.set(reviewWebContentsId, created.draft.id);
  reviewWindow.once('closed', () => {
    bugReportReviewDraftBySender.delete(reviewWebContentsId);
    bugReportReviewWindows.delete(reviewWindow);
    bugReports.discardDraftsForReviewWindow(reviewWebContentsId);
    if (mainWindows.size === 0 && bugReportReviewWindows.size === 0 && shouldQuitAfterLastWindow(process.platform)) {
      app.quit();
    }
  });

  const bound = bugReports.bindReviewWindow(created.draft.id, reviewWebContentsId);
  if (!bound.ok) {
    reviewWindow.destroy();
    bugReports.discardDraft(created.draft.id, source.webContentsId);
    await showBugReportError(win, 'StashBase could not authorize the bug report review.');
    return;
  }

  try {
    await review.loaded;
  } catch {
    if (!reviewWindow.isDestroyed()) reviewWindow.destroy();
    await showBugReportError(win, 'StashBase could not load the bug report review.');
  }
}

async function createWindow(initialFolder) {
  try {
    await ensureServer();
  } catch (err) {
    const message = String(err?.message ?? err);
    // Native error boxes are not BrowserWindows and can block unattended
    // launch diagnostics. Preserve the same failure in stdout before opening
    // the user-facing dialog so CI and terminal launches retain the cause.
    console.error(`[electron] StashBase failed to start: ${message}`);
    dialog.showErrorBox(
      'StashBase failed to start',
      `${message}${getServerLogPath() ? '\n\nServer log: available in the application log directory.' : ''}`,
    );
    if (mainWindows.size === 0) app.quit();
    return;
  }
  const windowId = crypto.randomUUID();
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 720,
    minHeight: 480,
    // Initial OS-level title; the renderer adds the current folder once it
    // opens so Mission Control/task switchers can distinguish windows.
    // There is no in-window titlebar strip — document.title is the only
    // place the folder identity is spelled out.
    title: 'StashBase',
    backgroundColor: '#fafafa',
    ...applicationWindowChromeOptions(process.platform),
    webPreferences: applicationWindowWebPreferences({
      preloadPath: path.join(PROJECT_ROOT, 'dist', 'electron', 'renderer', 'preload.cjs'),
      additionalArguments: [`--stashbase-server-origin=${SERVER_URL}`],
    }),
  });
  const webContentsId = win.webContents.id;
  if (!workspaceSessionRestoreWindow) workspaceSessionRestoreWindow = win;
  mainWindows.add(win);
  windowRegistry.add(windowId, win, initialFolder);
  if (
    libraryFolderDialogCapability &&
    libraryLifecycleCapability &&
    workspaceSessionCapability &&
    windowLifecycleCapability &&
    externalNavigationCapability &&
    captureCapability &&
    bugReportCapability
  ) {
    replacementWindowCapabilities.set(
      win,
      new Set([
        libraryFolderDialogCapability,
        libraryLifecycleCapability,
        workspaceSessionCapability,
        windowLifecycleCapability,
        externalNavigationCapability,
        captureCapability,
        bugReportCapability,
      ]),
    );
  }
  lastMainWindow = win;
  replacementWindowLifecycle?.attach(win);
  win.on('focus', () => {
    lastMainWindow = win;
    captureMonitor?.offerTo(win);
  });
  win.on('closed', () => {
    bugReports.discardUnreviewedDraftsForSource(webContentsId);
    mainWindows.delete(win);
    windowRegistry.remove(windowId);
    releaseWindowContext(windowId);
    if (lastMainWindow === win) {
      lastMainWindow = [...mainWindows].find((candidate) => isLiveMainWindow(candidate)) ?? null;
    }
    if (mainWindows.size === 0 && bugReportReviewWindows.size === 0) {
      if (shouldQuitAfterLastWindow(process.platform)) app.quit();
    }
  });

  secureApplicationWindow(win, RENDERER_ORIGIN);

  // Reload is a destructive renderer-context transition. Keep native reload
  // chords blocked until the document slice owns a typed save/recovery path.
  win.webContents.on('before-input-event', (event, input) => {
    // Own window-level input before it reaches the renderer. The native menu
    // still advertises the platform accelerator, while this boundary prevents
    // the same chord from also creating or closing a document tab.
    const windowAction = windowLifecycleShortcutAction(input);
    if (windowAction === 'new-window') {
      event.preventDefault();
      void createWindow();
      return;
    }
    if (windowAction === 'close-window') {
      event.preventDefault();
      win.close();
      return;
    }
    if (windowAction === 'block-reload') event.preventDefault();
  });

  const serverRendererUrl = initialFolder
    ? `${SERVER_URL}/?folder=${encodeURIComponent(initialFolder)}`
    : SERVER_URL;
  const url = USE_DEV_VITE ? serverRendererUrl : APP_URL;
  win.loadURL(url);
  return win;
}

function releaseWindowContext(windowId) {
  void releaseWindowContextWithRetry(() => (
    requestJson(SERVER_PORT, '/api/window', 1000, {
      method: 'DELETE',
      headers: { 'x-stashbase-window-id': windowId },
    })
  )).then(({ ok, result, attempts }) => {
    if (!ok) {
      const detail = result?.reachable ? `HTTP ${result.statusCode}` : 'server unreachable';
      console.warn(`[electron] window context cleanup failed after ${attempts} attempts: ${detail}`);
    }
  });
}

function focusLastMainWindow() {
  const focused = BrowserWindow.getFocusedWindow();
  const win = isLiveMainWindow(focused)
    ? focused
    : isLiveMainWindow(lastMainWindow)
      ? lastMainWindow
      : [...mainWindows].find((candidate) => isLiveMainWindow(candidate));
  if (!focusWindow(win)) return false;
  lastMainWindow = win;
  return true;
}

function installApplicationMenu() {
  const template = createApplicationMenuTemplate({
    platform: process.platform,
    onNewWindow: () => { void createWindow(); },
    onCloseWindow: (win) => {
      const target = isLiveMainWindow(win) ? win : BrowserWindow.getFocusedWindow();
      if (isLiveMainWindow(target)) target.close();
    },
    onOpenExternal: (url) => { void shell.openExternal(url); },
    onReportBug: () => {
      const target = BrowserWindow.getFocusedWindow();
      void openBugReportReview(isLiveMainWindow(target) ? target : lastMainWindow);
    },
    includeDeveloperTools: process.env.STASHBASE_DEV_VITE === '1',
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

const initialWindowFlight = createSingleFlight(() => app.whenReady().then(() => createWindow()));

function focusOAuthReturn() {
  void app.whenReady().then(async () => {
    const acknowledged = await requestJson(SERVER_PORT, '/api/account/oauth/app-return', 1000, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-stashbase-oauth-return-token': OAUTH_RETURN_TOKEN,
      },
    });
    if (!acknowledged.reachable || acknowledged.statusCode !== 200) {
      console.warn('[electron] could not acknowledge OAuth return to the callback page');
    }
    if (process.platform === 'darwin') app.focus({ steal: true });
    const targetId = typeof acknowledged.body?.windowId === 'string'
      ? acknowledged.body.windowId
      : null;
    const target = targetId ? windowRegistry.windowForId(targetId) : null;
    if (isLiveMainWindow(target) && focusWindow(target)) {
      lastMainWindow = target;
      return;
    }
    if (!focusLastMainWindow()) {
      await initialWindowFlight.run();
      focusLastMainWindow();
    }
  });
}

function registerOAuthReturnProtocol() {
  const registered = process.defaultApp && process.argv[1]
    ? app.setAsDefaultProtocolClient('stashbase', process.execPath, [path.resolve(process.argv[1])])
    : app.setAsDefaultProtocolClient('stashbase');
  if (!registered) console.warn('[electron] could not register the stashbase:// return protocol');
}

app.on('open-url', (event, url) => {
  if (isStashBaseProtocolUrl(url)) event.preventDefault();
  if (!isOAuthReturnUrl(url)) return;
  focusOAuthReturn();
});

const hasSingleInstanceLock = app.requestSingleInstanceLock();
const initialProtocolLaunch = classifyProtocolLaunch(process.argv);
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const protocolLaunch = classifyProtocolLaunch(argv);
    if (protocolLaunch === 'oauth-return') {
      focusOAuthReturn();
      return;
    }
    // A malformed or unsupported stashbase: URL must not fall through to the
    // ordinary second-launch focus/create behavior.
    if (protocolLaunch === 'inert') return;
    if (!focusLastMainWindow()) {
      void initialWindowFlight.run().then(() => { focusLastMainWindow(); });
    }
  });

  app.whenReady().then(async () => {
    registerOAuthReturnProtocol();
    // A cold unsupported stashbase: URL is just as inert as the same URL sent
    // to an existing instance: do not start the server or create a window.
    if (initialProtocolLaunch === 'inert') {
      app.quit();
      return;
    }
    installReplacementBoundary();
    installRequestAuthorization({
      rendererOrigins: new Set([RENDERER_ORIGIN]),
      serverOrigin: SERVER_URL,
      session: session.defaultSession,
      windowRegistrationForWebContentsId: (webContentsId) => (
        windowRegistry.registrationForWebContentsId(webContentsId)
      ),
    });
    try {
      await bugReportHandoff.initializeSession();
    } catch {
      console.warn('[electron] bug-report temporary session initialization failed');
    }
    // Refresh the MCP wrapper on every launch so the most recently-opened
    // app owns it. Without this, a wrapper written by an earlier `pnpm
    // dev` run still points at a vanished `node_modules/.bin/tsx`, and
    // Claude Code / Claude Desktop spawn it after a brew install with
    // "command not found" (or, on macOS, "Operation not permitted" when
    // the old path is under ~/Downloads and TCC blocks it). Skip silently
    // if the entry for *this* app isn't on disk — partial dev checkouts
    // shouldn't clobber a working packaged wrapper.
    try {
      if (fs.existsSync(MCP_ENTRY)) writeMcpWrapper();
    } catch (err) {
      console.warn(`[electron] MCP wrapper refresh failed: ${err && err.message ? err.message : err}`);
    }
    installApplicationMenu();
    await initialWindowFlight.run();
    await desktopUpdates.start();
    if (initialProtocolLaunch === 'oauth-return') focusOAuthReturn();
  });

  app.on('activate', () => {
    if (mainWindows.size === 0) {
      void createWindow();
    }
  });

  app.on('window-all-closed', () => {
    if (shouldQuitAfterLastWindow(process.platform)) app.quit();
  });
}

// Drag the server down with us on real shutdown. macOS keeps the
// process alive on window-close (Cmd+Q is the actual quit signal), so
// we hook `will-quit` rather than `window-all-closed` here.
//
// We need to **wait** for the server to actually exit before quitting
// Electron — otherwise the Python daemon orphans, still holding
// Milvus Lite's flock, and the next launch fails to open the DB.
// Hard 8 s ceiling so the server's 6.5 s cleanup ladder can finish without a
// stuck child pinning Electron forever.
let quitting = false;
app.on('will-quit', (event) => {
  if (quitting) return;
  // `.killed` only records that a signal was SENT (e.g. the spawn-timeout
  // path's SIGTERM) — the child may still be alive, and skipping the ladder
  // here would orphan it because the timeout path's SIGKILL timer is unref'd
  // and dies with us. Only a child that actually exited skips the ladder.
  if (!serverProc || serverProc.exitCode != null || serverProc.signalCode != null) return;
  event.preventDefault();
  quitting = true;
  void requestJson(SERVER_PORT, '/api/internal/shutdown', 1500, {
    method: 'POST',
    headers: { 'x-stashbase-shutdown-token': SERVER_SHUTDOWN_TOKEN },
  }).then((result) => {
    if (result.reachable && result.statusCode === 202) return;
    // POSIX receives this gracefully; Windows uses it only after the explicit
    // shutdown handshake failed, where forceful termination is preferable to
    // pinning the desktop process forever.
    try { serverProc.kill('SIGTERM'); } catch { /* already gone */ }
  });
  const fallback = setTimeout(() => {
    try { serverProc.kill('SIGKILL'); } catch { /* already gone */ }
    app.exit(process.exitCode || 0);
  }, 8000);
  serverProc.once('exit', () => {
    clearTimeout(fallback);
    app.exit(process.exitCode || 0);
  });
});

app.on('quit', () => {
  desktopUpdates.dispose();
});
