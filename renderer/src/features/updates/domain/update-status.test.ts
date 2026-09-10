/** The two questions the status union answers for itself: which offer it is,
 *  and whether main is already working. */
import { describe, expect, it } from 'vite-plus/test';

import { updateInProgress, updateStatusKey } from './update-status';

describe('updateStatusKey', () => {
  it('separates the same phase about two different versions', () => {
    // A dismissal is keyed on this, so a newer release has to read as a new
    // thing to say rather than as one the reader already waved away.
    expect(updateStatusKey({ phase: 'available', version: '2.1.0' })).not.toBe(
      updateStatusKey({ phase: 'available', version: '2.2.0' }),
    );
  });

  it('separates two phases about the same version', () => {
    expect(updateStatusKey({ phase: 'available', version: '2.1.0' })).not.toBe(
      updateStatusKey({ phase: 'ready', version: '2.1.0' }),
    );
  });

  it('keys a phase with no version on the phase alone', () => {
    expect(updateStatusKey({ phase: 'error' })).toBe('error');
    expect(updateStatusKey({ percent: 40, phase: 'downloading', version: '2.1.0' })).toBe(
      updateStatusKey({ percent: 80, phase: 'downloading', version: '2.1.0' }),
    );
  });
});

describe('updateInProgress', () => {
  it('reports the phases where main is already working', () => {
    expect(updateInProgress({ phase: 'checking' })).toBe(true);
    expect(updateInProgress({ percent: null, phase: 'downloading', version: '2.1.0' })).toBe(true);
    expect(updateInProgress({ phase: 'installing', version: '2.1.0' })).toBe(true);
  });

  it('leaves every settled phase askable', () => {
    expect(updateInProgress({ phase: 'idle' })).toBe(false);
    expect(updateInProgress({ phase: 'current' })).toBe(false);
    expect(updateInProgress({ phase: 'available', version: '2.1.0' })).toBe(false);
    expect(updateInProgress({ phase: 'ready', version: '2.1.0' })).toBe(false);
    expect(updateInProgress({ phase: 'error' })).toBe(false);
    expect(updateInProgress({ phase: 'unsupported' })).toBe(false);
  });
});
