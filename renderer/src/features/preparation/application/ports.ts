import {
  featureErrorClass,
  type FeatureError,
  type FeatureFailureKind,
} from '@/shared/domain/feature-error';
import type { FolderIndexStatus } from '@/shared/domain/folder-index-status';
import type { SourceReference } from '@/shared/domain/source-reference';

export interface PreparationStatusPort {
  load(folderPath: string, signal: AbortSignal): Promise<FolderIndexStatus>;
}

export interface PreparationControlPort {
  /** Queue or promote DOCX preparation on open. Never destructive. */
  prepare(source: SourceReference, signal: AbortSignal): Promise<void>;
  reprocess(source: SourceReference, signal: AbortSignal): Promise<'conversion' | 'index'>;
  cancel(source: SourceReference, signal: AbortSignal): Promise<boolean>;
  /** Reconcile one folder with its disk after something outside the app
   *  wrote to it. Folder-explicit; resolves false when the sync was cut short. */
  sync(folderPath: string, signal: AbortSignal): Promise<boolean>;
}

type PreparationExtra = 'unsupported';

export type PreparationFailureKind = FeatureFailureKind<PreparationExtra>;

export type PreparationError = FeatureError<PreparationExtra>;
export const PreparationError = featureErrorClass<PreparationExtra>('PreparationError');
