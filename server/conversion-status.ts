/**
 * Conversion status (PDF + image) backed by `<KB>/.stashbase/state.db`.
 *
 * A small domain wrapper over the `state-db.ts` row primitives: the
 * conversion / UI pipeline speaks `markInFlight` / `markDone` /
 * `markFailed` / `hasRecord` etc., this maps them onto the `conversions`
 * table. Both unstructured kinds (pdf_extract, ocr_extract) share it.
 */
import {
  clearConversionStatus,
  getConversionStatus,
  hasConversionStatus,
  listConversionStatus,
  readConversionStatusMap,
  setConversionStatus,
  type ConversionStatus,
  type ConversionStatusEntry,
} from './state-db.ts';

export type { ConversionStatus, ConversionStatusEntry };
export type ConversionStatusMap = Record<string, ConversionStatusEntry>;

export function readAll(): ConversionStatusMap {
  return readConversionStatusMap();
}

export function getEntry(kbRel: string): ConversionStatusEntry | undefined {
  return getConversionStatus(kbRel);
}

export function hasRecord(kbRel: string): boolean {
  return hasConversionStatus(kbRel);
}

export function markInFlight(kbRel: string): void {
  setConversionStatus(kbRel, 'in-flight', { incrementAttempts: true });
}

export function markDone(kbRel: string): void {
  setConversionStatus(kbRel, 'done');
}

export function markFailed(kbRel: string, errorMsg: string): void {
  setConversionStatus(kbRel, 'failed', { error: errorMsg });
}

export function clearRecord(kbRel: string): void {
  clearConversionStatus(kbRel);
}

export function listByStatus(status: ConversionStatus): Array<{ path: string; entry: ConversionStatusEntry }> {
  return listConversionStatus(status);
}
