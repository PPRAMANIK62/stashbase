export {
  DocumentSaveError,
  DocumentSourceError,
  type DocumentQueryScope,
  type DocumentSaveFailureKind,
  type DocumentSourceApi,
  type DocumentSourceFailureKind,
  type DocumentWindowLifecycle,
} from './application/ports';
export { createDocumentQueryScope } from './application/queries';
export {
  createDocumentTabsRuntime,
  type DocumentSessionProjection,
  type DocumentTabsScope,
  type DocumentTabsRuntime,
} from './application/tabs-runtime';
export type { DocumentRuntime } from './application/document-runtime';
export { createDocumentSourceApi } from './infrastructure/source-api';
export { createDocumentWindowLifecycle } from './infrastructure/window-lifecycle';
export { useDocumentSaveBarrier } from './hooks/use-document-save-barrier';
export { DocumentTabs, type DocumentTabsProps } from './ui/document-tabs';
export { DocumentWorkspace, type DocumentWorkspaceProps } from './ui/document-workspace';
