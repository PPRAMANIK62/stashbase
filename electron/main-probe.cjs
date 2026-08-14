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
 * launches need development runtime behavior even when they serve the built
 * renderer. `STASHBASE_DEV_VITE` is narrower: preserve it only when the caller
 * explicitly knows a Vite renderer is running. Packaged launches inherit
 * neither development mode. */
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
  if (packaged) {
    delete environment.STASHBASE_DEV_RUNTIME;
    delete environment.STASHBASE_DEV_VITE;
  } else {
    environment.STASHBASE_DEV_RUNTIME = '1';
  }
  return environment;
}

/** Keep the Electron-owned process single-layered unless the caller is an
 * explicit Vite development session. A watch wrapper can outlive or orphan
 * its actual listener during Electron shutdown, while direct source and E2E
 * launches need one child whose exit is the server lifecycle boundary. */
function createServerArguments({ entry, portArgs, packaged, vite }) {
  if (packaged) return [entry, ...portArgs];
  return vite ? ['watch', entry, ...portArgs] : [entry, ...portArgs];
}

module.exports = {
  createServerArguments,
  createServerChildEnvironment,
  isCompatibleServerHealth,
};
