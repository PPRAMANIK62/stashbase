export {
  DocumentAssetError,
  DocumentSaveError,
  DocumentSourceError,
  DocxPreviewError,
  GenericFilePreviewError,
  MediaError,
  type DocumentAssetApi,
  type DocumentAssetFailureKind,
  type DocumentQueryScope,
  type DocumentSaveFailureKind,
  type DocumentSourceApi,
  type DocumentSourceFailureKind,
  type DocumentWindowLifecycle,
  type DocxPreviewApi,
  type DocxPreviewFailureKind,
  type GenericFilePreviewApi,
  type GenericFilePreviewFailureKind,
  type MediaApi,
  type MediaFailureKind,
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
export { createDocxPreviewApi } from './infrastructure/docx-preview-api';
export { createGenericFilePreviewApi } from './infrastructure/generic-preview-api';
export { createMediaApi } from './infrastructure/media-api';
export { createDocumentWindowLifecycle } from './infrastructure/window-lifecycle';
export { useDocumentSaveBarrier } from './hooks/use-document-save-barrier';
export { DocumentTabs, type DocumentTabsProps } from './ui/workspace/tabs';
export { DocumentOutline } from './ui/workspace/outline';
export { DocumentWorkspace, type DocumentWorkspaceProps } from './ui/workspace/workspace';
