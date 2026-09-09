import {
  PreparationError,
  type PreparationStatusApi,
} from '@/features/preparation/application/ports';
import type { HttpClient, HttpResponse } from '@/platform/http/client';
import {
  indexStatusFailureSchema,
  indexStatusResponseSchema,
  type IndexStatusResponseWire,
} from '@/protocols/http/index-status';
import type { FolderIndexStatus } from '@/shared/domain/folder-index-status';

export function mapIndexStatus(wire: IndexStatusResponseWire): FolderIndexStatus {
  return {
    blockedConversions: wire.blockedConversions,
    conversionProgress: wire.conversionProgress,
    conversionRevision: wire.conversionRevision,
    conversionVersions: wire.conversionVersions,
    folderPath: wire.folder,
    indexed: wire.indexed,
    pendingConversions: wire.pendingConversions,
    preparationFailures: wire.preparationFailures,
    semantic: {
      available: wire.semanticAvailable,
      disabledReason: wire.semanticDisabledReason ?? null,
      enabled: wire.semanticEnabled,
      estimatedBytes: wire.semanticIndexing.estimatedBytes ?? null,
      indexReady: wire.indexReady,
      pending: wire.pending,
      settled: wire.visibleIndexingSettled,
      sourceCount: wire.semanticIndexing.sourceCount ?? null,
      state: wire.semanticIndexing.state,
      warning: wire.indexWarning,
    },
    total: wire.total,
    treeVersion: wire.treeVersion,
  };
}

function statusError(response: HttpResponse): PreparationError {
  const failure = indexStatusFailureSchema.safeParse(response.body);
  const scopeLost =
    response.status === 404 ||
    response.status === 410 ||
    response.status === 412 ||
    failure.data?.code === 'FOLDER_NOT_FOUND' ||
    failure.data?.code === 'NO_FOLDER';
  return new PreparationError(
    scopeLost ? 'scope-lost' : 'unavailable',
    scopeLost
      ? 'This folder is no longer available in this window.'
      : 'Preparation status is unavailable.',
    failure.success ? { cause: new Error(failure.data.error) } : undefined,
  );
}

export function createPreparationStatusApi(client: HttpClient): PreparationStatusApi {
  return {
    async load(folderPath, signal) {
      const query = new URLSearchParams({ folder: folderPath });
      let response: HttpResponse;
      try {
        response = await client.request({ path: `/api/index-status?${query}`, signal });
      } catch (error) {
        if (signal.aborted) throw error;
        throw new PreparationError('unavailable', 'Preparation status is unavailable.', {
          cause: error,
        });
      }
      if (response.status < 200 || response.status >= 300) throw statusError(response);
      const parsed = indexStatusResponseSchema.safeParse(response.body);
      if (!parsed.success) {
        throw new PreparationError(
          'invalid-response',
          'Preparation status returned an invalid response.',
        );
      }
      return mapIndexStatus(parsed.data);
    },
  };
}
