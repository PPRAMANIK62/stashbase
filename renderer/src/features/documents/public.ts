/**
 * The Documents feature's whole surface to `renderer/src/app`.
 *
 * Everything here is imported by app composition; nothing else leaves the
 * feature. The viewer registry, the save state, the format vocabulary, and
 * every view below the workspace stay internal, so adding a format or
 * reshaping the save lifecycle never reaches the shell. What only a test
 * builds lives in `test-support.ts`.
 */
export { createDocumentQueryScope, refreshDocumentSources } from './application/queries';
export { createDocumentTabsRuntime, type DocumentTabsRuntime } from './application/tabs-runtime';
export type { DocumentRuntime } from './application/document-runtime';
export { createRecoveryJournalist } from './application/recovery-journalist';
export { createRecoveryRuntime, type RecoveryRuntime } from './application/recovery-runtime';
export { RecoveryDrafts } from './ui/recovery/recovery-drafts';
export type { DocumentSearchTarget } from './application/navigation-runtime';
export { createDocumentAdapters, type DocumentAdapters } from './infrastructure/adapters';
export { useDocumentCommands } from './hooks/use-document-commands';
export { useDocumentSaveBarrier } from './hooks/use-document-save-barrier';
export { useHasOpenDocuments, useOpenDocumentSources } from './hooks/use-open-documents';
export { DocumentTabs } from './ui/workspace/tabs';
export { DocumentOutline } from './ui/workspace/outline';
export { DocumentWorkspace } from './ui/workspace/workspace';
export type { DocumentNavigationTarget } from './ui/source/viewer';
