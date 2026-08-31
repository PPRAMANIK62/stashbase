'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const {
  applicationWindowWebPreferences,
  isAllowedApplicationUrl,
  secureApplicationWindow,
} = require('./window-security.cjs');

test('application windows use the restrictive replacement preferences by default', () => {
  assert.deepEqual(applicationWindowWebPreferences({ preloadPath: '/app/preload.cjs' }), {
    preload: '/app/preload.cjs',
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    webviewTag: false,
    experimentalFeatures: false,
    allowRunningInsecureContent: false,
    additionalArguments: [],
  });
});

test('application URL policy accepts only the configured renderer origin', () => {
  assert.equal(isAllowedApplicationUrl('app://renderer/', 'app://renderer'), true);
  assert.equal(isAllowedApplicationUrl('app://renderer/assets/app.js', 'app://renderer'), true);
  assert.equal(isAllowedApplicationUrl('app://other/', 'app://renderer'), false);
  assert.equal(isAllowedApplicationUrl('https://example.com/', 'app://renderer'), false);
  assert.equal(
    isAllowedApplicationUrl('http://127.0.0.1:8090/path', 'http://127.0.0.1:8090'),
    true,
  );
  assert.equal(
    isAllowedApplicationUrl('http://127.0.0.1:8091/path', 'http://127.0.0.1:8090'),
    false,
  );
});

test('application windows deny popups, unexpected navigation, webviews, and permissions', () => {
  const webContents = new EventEmitter();
  let openHandler;
  let permissionCheck;
  let permissionRequest;
  webContents.setWindowOpenHandler = (handler) => { openHandler = handler; };
  webContents.session = {
    setPermissionCheckHandler(handler) { permissionCheck = handler; },
    setPermissionRequestHandler(handler) { permissionRequest = handler; },
  };

  secureApplicationWindow({ webContents }, 'app://renderer');
  assert.deepEqual(openHandler({ url: 'https://example.com' }), { action: 'deny' });

  let prevented = false;
  webContents.emit('will-navigate', { preventDefault() { prevented = true; } }, 'app://renderer/');
  assert.equal(prevented, false);
  webContents.emit(
    'will-navigate',
    { preventDefault() { prevented = true; } },
    'https://example.com/',
  );
  assert.equal(prevented, true);

  prevented = false;
  webContents.emit('will-attach-webview', { preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(permissionCheck(), false);
  let permissionGranted = true;
  permissionRequest(null, 'camera', (allowed) => { permissionGranted = allowed; });
  assert.equal(permissionGranted, false);
});
