/**
 * Workspace values only a test can want.
 *
 * `public.ts` used to publish the two runtime constructors and the query-key
 * registry so the app's own tests could build a workspace by hand. Nothing the
 * running app does needs any of them, and a barrel that also answers to tests
 * stops describing the feature. They live here instead, behind a dependency
 * rule that admits only a `*.test.*` file.
 */
export { workspaceQueryKeys } from './application/queries';
export { createWorkspaceRuntime } from './application/runtime';
export { createWorkspaceSessionRuntime } from './application/session-runtime';
