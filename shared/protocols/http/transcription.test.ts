import assert from 'node:assert/strict';
import test from 'node:test';

import {
  transcriptionModelDownloadResponseSchema,
  transcriptionPreferencesRequestSchema,
  transcriptionSettingsSchema,
} from './transcription.ts';

test('transcription settings accept providers with model operations', () => {
  const parsed = transcriptionSettingsSchema.parse({
    language: 'auto',
    modelId: 'base',
    providerId: 'whisper-cpp',
    providers: [
      {
        description: 'Runs on this machine.',
        id: 'whisper-cpp',
        kind: 'local',
        label: 'Local',
        models: [
          {
            available: false,
            id: 'base',
            label: 'Base',
            management: 'local-download',
            operation: { receivedBytes: 10, status: 'downloading', totalBytes: 100 },
            sizeBytes: 100,
          },
        ],
      },
    ],
  });
  assert.equal(parsed.providers[0]?.models[0]?.operation?.status, 'downloading');
});

test('preferences and download responses reject unknown operation states', () => {
  assert.equal(transcriptionPreferencesRequestSchema.safeParse({ language: 'en' }).success, true);
  assert.equal(transcriptionPreferencesRequestSchema.safeParse({ other: 1 }).success, false);
  assert.equal(
    transcriptionModelDownloadResponseSchema.safeParse({
      download: { status: 'paused' },
      id: 'base',
    }).success,
    false,
  );
});
