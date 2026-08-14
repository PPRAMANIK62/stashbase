function isCompatibleServerHealth(body, expected) {
  if (!body || typeof body !== 'object') return false;
  if (body.app !== 'stashbase') return false;
  if (body.ok !== true) return false;
  if (body.protocolVersion !== expected.protocolVersion) return false;
  if (body.appRoot !== expected.appRoot) return false;
  if (body.resourcesPath !== expected.resourcesPath) return false;
  return true;
}

/** Build the environment for the Electron-owned server process. Source
 * launches are development launches even when the user starts `pnpm electron`
 * directly instead of winning the port race with `pnpm dev:server`.
 * Conversely, a packaged app must not inherit the Vite marker from its host. */
function createServerChildEnvironment({
  baseEnv,
  packaged,
  packagedEnv,
  shutdownToken,
  oauthReturnToken,
}) {
  const environment = {
    ...baseEnv,
    ...packagedEnv,
    STASHBASE_SHUTDOWN_TOKEN: shutdownToken,
    STASHBASE_OAUTH_RETURN_TOKEN: oauthReturnToken,
  };
  if (packaged) delete environment.STASHBASE_DEV_VITE;
  else environment.STASHBASE_DEV_VITE = '1';
  return environment;
}

module.exports = {
  createServerChildEnvironment,
  isCompatibleServerHealth,
};
