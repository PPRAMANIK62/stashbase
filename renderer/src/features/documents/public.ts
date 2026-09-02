export {
  DocumentSourceError,
  type DocumentQueryScope,
  type DocumentSourceApi,
  type DocumentSourceFailureKind,
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
export { DocumentTabs, type DocumentTabsProps } from './ui/document-tabs';
export { DocumentWorkspace, type DocumentWorkspaceProps } from './ui/document-workspace';
