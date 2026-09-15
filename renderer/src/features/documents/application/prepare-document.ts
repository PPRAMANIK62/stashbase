import type { QueryClient } from '@tanstack/react-query';

import type { DocumentScope } from '@/features/documents/domain/document';
import {
  documentTextFormat,
  documentViewerFormat,
} from '@/features/documents/domain/document-format';

import {
  documentFailure,
  DOCUMENT_ASSET_MESSAGES,
  DOCUMENT_SOURCE_MESSAGES,
  GENERIC_PREVIEW_MESSAGES,
} from './failure-messages';
import type { DocumentAssetPort, DocumentSourcePort, GenericFilePreviewPort } from './ports';
import { documentAssetQuery, documentSourceQuery, genericFilePreviewQuery } from './queries';

/** Resolve a candidate before a usable preview gives up its slot. */
export async function prepareDocument(
  client: QueryClient,
  ports: {
    source: DocumentSourcePort;
    asset: DocumentAssetPort;
    genericPreview: GenericFilePreviewPort;
  },
  scope: DocumentScope,
): Promise<string | null> {
  const format = documentViewerFormat(scope.source.path);
  try {
    if (documentTextFormat(scope.source.path))
      await client.fetchQuery(documentSourceQuery(ports.source, scope));
    else if (format === 'generic')
      await client.fetchQuery(genericFilePreviewQuery(ports.genericPreview, scope));
    else await client.fetchQuery(documentAssetQuery(ports.asset, scope));
    return null;
  } catch (error) {
    if (documentTextFormat(scope.source.path))
      return documentFailure(error, 'DocumentSourceError', DOCUMENT_SOURCE_MESSAGES).message;
    return format === 'generic'
      ? documentFailure(error, 'GenericFilePreviewError', GENERIC_PREVIEW_MESSAGES).message
      : documentFailure(error, 'DocumentAssetError', DOCUMENT_ASSET_MESSAGES).message;
  }
}
