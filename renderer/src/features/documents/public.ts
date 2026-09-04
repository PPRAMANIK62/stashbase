export {
  DocumentAssetError,
  DocumentSaveError,
  DocumentSourceError,
  GenericFilePreviewError,
  type DocumentAssetApi,
  type DocumentAssetFailureKind,
  type DocumentQueryScope,
  type DocumentSaveFailureKind,
  type DocumentSourceApi,
  type DocumentSourceFailureKind,
  type DocumentWindowLifecycle,
  type GenericFilePreviewApi,
  type GenericFilePreviewFailureKind,
} from './application/ports';
export { createDocumentQueryScope } from './application/queries';
export {
  createDocumentTabsRuntime,
  type DocumentSessionProjection,
  type DocumentTabsScope,
  type DocumentTabsRuntime,
} from './application/tabs-runtime';
export type { DocumentRuntime } from './application/document-runtime';
export {
  createDocumentNavigationRuntime,
  type DocumentFindController,
  type DocumentNavigationRuntime,
  type FindMatchInfo,
  type FindOptions,
} from './application/navigation-runtime';
export { createDocumentSourceApi } from './infrastructure/source-api';
export { createDocumentAssetApi } from './infrastructure/asset-api';
export { createGenericFilePreviewApi } from './infrastructure/generic-preview-api';
export { createDocumentWindowLifecycle } from './infrastructure/window-lifecycle';
export { useDocumentSaveBarrier } from './hooks/use-document-save-barrier';
export { DocumentTabs, type DocumentTabsProps } from './ui/document-tabs';
export { DocumentOutline } from './ui/document-outline';
export { DocumentWorkspace, type DocumentWorkspaceProps } from './ui/document-workspace';
