/**
 * Transcription engines, models, and the one preference triple the reader
 * edits. The feature's own vocabulary: `infrastructure/transcription-api.ts`
 * translates the transport shapes into these, so nothing above it has to
 * know that the wire spells an absent field as a missing key or that a model
 * with no operation is idle.
 */

/** What a locally managed model is doing right now. A model that has never
 *  been touched is `idle`, never `undefined`. */
export type TranscriptionModelOperation =
  | { readonly status: 'idle' }
  | { readonly status: 'verifying' }
  | { readonly status: 'downloading'; readonly receivedBytes: number; readonly totalBytes: number }
  | { readonly status: 'failed'; readonly error: string };

export interface TranscriptionModel {
  readonly accuracy: string | null;
  /** Installed on this device (local models) or offered by the service. */
  readonly available: boolean;
  readonly id: string;
  readonly label: string;
  /** `provider` models arrive with the service and are never downloaded. */
  readonly management: 'local-download' | 'provider';
  readonly operation: TranscriptionModelOperation;
  readonly resourceUse: string | null;
  readonly sizeBytes: number | null;
  readonly speed: string | null;
}

export interface TranscriptionProvider {
  readonly description: string;
  readonly id: string;
  readonly kind: 'local' | 'remote';
  readonly label: string;
  readonly models: readonly TranscriptionModel[];
  /** The engine itself could not start; the panel says so without hiding the
   *  rest of the settings. */
  readonly runtimeError: string | null;
}

export interface TranscriptionSettings {
  readonly language: string;
  readonly modelId: string;
  readonly providerId: string;
  readonly providers: readonly TranscriptionProvider[];
}

/** The saved triple a preference write answers with. */
export interface TranscriptionPreferences {
  readonly language: string;
  readonly modelId: string;
  readonly providerId: string;
}

/** A partial write; the server requires a model whenever the provider moves. */
export interface TranscriptionPreferencesPatch {
  readonly language?: string;
  readonly modelId?: string;
  readonly providerId?: string;
}

/** The provider whose models are on screen: the selected one, else the first. */
export function activeProvider(settings: TranscriptionSettings): TranscriptionProvider | null {
  return (
    settings.providers.find((candidate) => candidate.id === settings.providerId) ??
    settings.providers[0] ??
    null
  );
}
