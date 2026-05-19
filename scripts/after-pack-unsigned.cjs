const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);
  if (!fs.existsSync(appPath)) {
    throw new Error(`Expected macOS app bundle was not found: ${appPath}`);
  }

  execFileSync('/usr/bin/xattr', ['-cr', appPath], { stdio: 'inherit' });
  execFileSync('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', appPath], {
    stdio: 'inherit',
  });
};
