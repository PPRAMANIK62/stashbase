import { describe, expect, it } from 'vite-plus/test';

import type { FolderIndexStatus } from '@/shared/domain/folder-index-status';

import {
  availableActions,
  folderPreparationSummary,
  preparationPollInterval,
  readinessStatusLine,
  sourcePathForRecord,
  sourceReadiness,
  treeMarker,
} from './readiness';

function status(overrides: Partial<FolderIndexStatus> = {}): FolderIndexStatus {
  return {
    blockedConversions: [],
    conversionProgress: {},
    conversionRevision: 0,
    conversionVersions: {},
    folderPath: '/library/research',
    indexed: 0,
    pendingConversions: [],
    preparationFailures: [],
    semantic: {
      available: false,
      disabledReason: 'Embedding source required',
      enabled: false,
      estimatedBytes: null,
      indexReady: true,
      pending: [],
      settled: true,
      sourceCount: null,
      state: 'disabled',
      warning: null,
    },
    total: 0,
    treeVersion: 0,
    ...overrides,
  };
}

describe('source readiness', () => {
  it('maps a legacy derived note record back to its visible source', () => {
    expect(sourcePathForRecord('papers/.report.pdf.md')).toBe('papers/report.pdf');
    expect(sourcePathForRecord('.notes.md')).toBe('notes');
    expect(sourcePathForRecord('papers/report.pdf')).toBe('papers/report.pdf');
  });

  it('prefers durable failure records over in-flight progress', () => {
    const snapshot = status({
      conversionProgress: { 'a.pdf': { currentPage: 2, phase: 'extracting' } },
      pendingConversions: ['a.pdf', 'b.png'],
      preparationFailures: [
        { attempts: 1, lastError: 'boom', path: 'papers/.a.pdf.md', status: 'failed' },
      ],
    });
    expect(sourceReadiness(snapshot, 'papers/a.pdf')).toEqual({
      attempts: 1,
      error: 'boom',
      kind: 'failed',
    });
    expect(sourceReadiness(snapshot, 'a.pdf')).toEqual({
      kind: 'pending',
      progress: { currentPage: 2, phase: 'extracting' },
    });
    expect(sourceReadiness(snapshot, 'b.png')).toEqual({ kind: 'pending', progress: null });
    expect(sourceReadiness(snapshot, 'c.md')).toEqual({ kind: 'current' });
    expect(sourceReadiness(null, 'c.md')).toEqual({ kind: 'current' });
  });

  it('marks blocked, failed, and cancelled rows but never pending rows', () => {
    expect(treeMarker({ kind: 'pending', progress: null })).toBeNull();
    expect(treeMarker({ kind: 'blocked' })?.kind).toBe('blocked');
    expect(treeMarker({ kind: 'cancelled' })?.kind).toBe('cancelled');
    expect(treeMarker({ attempts: 1, error: '', kind: 'failed' })?.kind).toBe('failed');
  });

  it('phrases progress by format', () => {
    expect(
      readinessStatusLine(
        { kind: 'pending', progress: { currentPage: 4, phase: 'extracting' } },
        'pdf',
      ),
    ).toBe('Reading page 4…');
    expect(
      readinessStatusLine({ kind: 'pending', progress: { phase: 'extracting' } }, 'image'),
    ).toBe('Reading image text…');
    expect(
      readinessStatusLine(
        { kind: 'pending', progress: { lane: 'light', phase: 'queued', tasksAhead: 3 } },
        'docx',
      ),
    ).toBe('Waiting for other file preparation to finish…');
    expect(readinessStatusLine({ kind: 'current' }, 'pdf')).toBeNull();
    expect(readinessStatusLine({ attempts: 1, error: '', kind: 'failed' }, 'image')).toContain(
      'still opens normally',
    );
  });

  it('summarises attention and picks a poll cadence', () => {
    const idle = status();
    expect(folderPreparationSummary(idle).needsAttention).toBe(false);
    expect(preparationPollInterval(idle)).toBe(8_000);
    const busy = status({ blockedConversions: ['talk.mp3'], pendingConversions: ['a.pdf'] });
    expect(folderPreparationSummary(busy)).toMatchObject({
      blocked: 1,
      needsAttention: true,
      pending: 1,
    });
    expect(preparationPollInterval(busy)).toBe(1_500);
    expect(preparationPollInterval(null)).toBe(1_500);
  });

  it('offers cancel while pending and reprocess after failure or cancellation', () => {
    expect(availableActions({ kind: 'pending', progress: null })).toEqual({
      cancel: true,
      reprocess: false,
    });
    expect(availableActions({ kind: 'cancelled' })).toEqual({ cancel: false, reprocess: true });
    expect(availableActions({ kind: 'current' })).toEqual({ cancel: false, reprocess: false });
  });
});
