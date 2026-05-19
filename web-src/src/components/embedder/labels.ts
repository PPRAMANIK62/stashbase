/**
 * Shared display labels for the embedder providers. Both the chip in
 * `EmbedderControl` and the confirmation modal use the same strings;
 * pulled out so a future relabel only touches one file.
 */
import type { EmbedderProvider } from '../../api';

export const LABEL: Record<EmbedderProvider, string> = {
  onnx: 'Local',
  openai: 'OpenAI',
};

export const DETAIL: Record<EmbedderProvider, string> = {
  onnx: 'bge-m3 · on-device',
  openai: 'text-embedding-3-small · API',
};
