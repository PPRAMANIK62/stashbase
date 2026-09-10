import { vi } from 'vite-plus/test';

import type { AppDependencies } from '@/app/dependencies';
import type {
  DocumentAssetPort,
  DocumentQueryScope,
  DocumentSourcePort,
  DocumentWindowLifecyclePort,
  DocxPreviewPort,
  GenericFilePreviewPort,
  MediaPort,
  RecoveryDraftPort,
} from '@/features/documents/application/ports';
import type { DocumentTabsRuntimeOptions } from '@/features/documents/application/tabs-runtime';
import type { DocumentTextSource } from '@/features/documents/domain/document';
import type { DocumentAdapters } from '@/features/documents/infrastructure/adapters';

/** A loaded Markdown source; every field is overridable. */
export function textSource(overrides: Partial<DocumentTextSource> = {}): DocumentTextSource {
  return { content: '# Plan', format: 'md', version: 'v1', ...overrides };
}

export function sourceApi(overrides: Partial<DocumentSourcePort> = {}): DocumentSourcePort {
  return {
    load: vi.fn(async () => textSource()),
    overwrite: vi.fn(async () => textSource({ version: 'v2' })),
    save: vi.fn(async () => textSource({ version: 'v2' })),
    ...overrides,
  };
}

/** A source API whose every call hangs, for a test that asserts what the
 *  workspace shows while a load is still in flight. */
export function pendingSourceApi(): DocumentSourcePort {
  return sourceApi({
    load: vi.fn(() => new Promise<never>(() => undefined)),
    overwrite: vi.fn(() => new Promise<never>(() => undefined)),
    save: vi.fn(() => new Promise<never>(() => undefined)),
  });
}

export function assetApi(overrides: Partial<DocumentAssetPort> = {}): DocumentAssetPort {
  return {
    load: vi.fn(async () => ({ kind: 'source' as const, url: 'blob:asset', version: 'v1' })),
    ...overrides,
  };
}

export function docxPreviewApi(overrides: Partial<DocxPreviewPort> = {}): DocxPreviewPort {
  return { load: vi.fn(async () => ({ html: '' })), ...overrides };
}

export function genericPreviewApi(
  overrides: Partial<GenericFilePreviewPort> = {},
): GenericFilePreviewPort {
  return {
    load: vi.fn(async () => ({ kind: 'binary' as const, name: 'file.bin', size: 0 })),
    ...overrides,
  };
}

export function mediaApi(overrides: Partial<MediaPort> = {}): MediaPort {
  return {
    cancelTranscript: vi.fn(async () => true),
    loadPreviewStatus: vi.fn(async () => ({ status: 'ready' as const })),
    loadTranscript: vi.fn(async () => ({ status: 'failed' as const })),
    preparePreview: vi.fn(async () => undefined),
    reprocessTranscript: vi.fn(async () => undefined),
    ...overrides,
  };
}

/** A recovery journal that is available and empty; every call is overridable. */
export function recoveryApi(overrides: Partial<RecoveryDraftPort> = {}): RecoveryDraftPort {
  return {
    discard: vi.fn(async () => undefined),
    list: vi.fn(async () => ({ available: true as const, drafts: [] })),
    read: vi.fn(async () => {
      throw new Error('no draft');
    }),
    write: vi.fn(async () => ({ savedAt: '2026-09-10T08:00:00.000Z' })),
    ...overrides,
  };
}

export function documentWindowLifecycle(
  overrides: Partial<DocumentWindowLifecyclePort> = {},
): DocumentWindowLifecyclePort {
  return { onPrepareContextRelease: vi.fn(() => () => undefined), ...overrides };
}

export function documentQueryScope(
  overrides: Partial<DocumentQueryScope> = {},
): DocumentQueryScope {
  return {
    cancel: vi.fn(async () => undefined),
    remove: vi.fn(),
    replaceSource: vi.fn(),
    ...overrides,
  };
}

/** Options for `createDocumentTabsRuntime`. Ids run `tab-1`, `tab-2`, … per
 *  runtime unless the test pins its own. */
export function documentTabsRuntimeOptions(
  overrides: Partial<DocumentTabsRuntimeOptions> = {},
): DocumentTabsRuntimeOptions {
  let nextId = 0;
  return {
    api: pendingSourceApi(),
    createId: () => `tab-${++nextId}`,
    createQueries: () => documentQueryScope(),
    folderPath: '/library/notes',
    generation: 1,
    ...overrides,
  };
}

/** Every Documents port, as one record. Override one entry at a time. */
export function documentAdapters(overrides: Partial<DocumentAdapters> = {}): DocumentAdapters {
  return {
    asset: assetApi(),
    docxPreview: docxPreviewApi(),
    genericPreview: genericPreviewApi(),
    media: mediaApi(),
    recovery: recoveryApi(),
    source: sourceApi(),
    windowLifecycle: documentWindowLifecycle(),
    ...overrides,
  };
}

/** The whole `documents` slice of the app dependencies. */
export function documentsApi(
  overrides: Partial<AppDependencies['documents']> = {},
): AppDependencies['documents'] {
  let nextId = 0;
  return {
    adapters: documentAdapters(),
    createId: vi.fn(() => `tab-${++nextId}`),
    openExternal: vi.fn(async () => true),
    ...overrides,
  };
}
