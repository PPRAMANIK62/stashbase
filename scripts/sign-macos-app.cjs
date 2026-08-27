const path = require('node:path');
const { signAsync } = require('@electron/osx-sign');

const openCodeEntitlements = path.resolve(
  __dirname,
  '..',
  'build',
  'entitlements.mac.opencode.plist',
);
const openCodeSuffix = path.join('Contents', 'Resources', 'opencode', 'opencode.exe');

function isBundledOpenCode(filePath) {
  return filePath.endsWith(openCodeSuffix);
}

function optionsForSignedFile(filePath, inherited) {
  if (!isBundledOpenCode(filePath)) return inherited;
  return { ...inherited, entitlements: openCodeEntitlements };
}

/** electron-builder owns identity discovery, hardened-runtime flags, nested
 * signing order, and notarization. This adapter changes only the entitlement
 * file for the bundled Bun/OpenCode executable and delegates the same signing
 * operation back to electron-osx-sign. */
async function signMacosApp(options) {
  const inheritedOptionsForFile = options.optionsForFile;
  await signAsync({
    ...options,
    optionsForFile: async (filePath) => optionsForSignedFile(
      filePath,
      inheritedOptionsForFile ? await inheritedOptionsForFile(filePath) : null,
    ),
  });
}

module.exports = signMacosApp;
module.exports.isBundledOpenCode = isBundledOpenCode;
module.exports.optionsForSignedFile = optionsForSignedFile;
module.exports.openCodeEntitlements = openCodeEntitlements;
