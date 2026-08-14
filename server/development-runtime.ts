/**
 * Development runtime and Vite renderer mode are related but not identical.
 * A source Electron launch needs live Python sources and Agent debug controls
 * even when it serves the built renderer without a Vite process.
 */
export function isDevelopmentRuntime(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.STASHBASE_DEV_RUNTIME === '1' || env.STASHBASE_DEV_VITE === '1';
}
