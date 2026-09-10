/**
 * The Updates feature's whole surface to `renderer/src/app`.
 *
 * One port, two view models, one strip. The window volunteers an offer through
 * `UpdateNotice`; Settings answers the same question on request through
 * `useSoftwareUpdate`, whose row is named in `@/shared/domain/software-update`
 * so the Settings feature can render it without importing this one.
 */
export type { UpdatesPort } from './application/ports';
export { createUpdatesAdapter } from './infrastructure/updates-bridge';
export { useSoftwareUpdate } from './hooks/use-software-update';
export { useUpdateNotice } from './hooks/use-update-notice';
export { UpdateNotice } from './ui/update-notice';
