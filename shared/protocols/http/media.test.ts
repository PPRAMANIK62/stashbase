import assert from "node:assert/strict";
import test from "node:test";

import {
  mediaCancelResponseSchema,
  mediaPreviewStatusSchema,
  mediaRequestSchema,
  mediaTranscriptResponseSchema,
} from "./media.ts";

test("media requests require explicit folder and source identities", () => {
  assert.deepEqual(
    mediaRequestSchema.parse({ folderPath: "/library/interviews", path: "calls/weekly.m4a" }),
    { folderPath: "/library/interviews", path: "calls/weekly.m4a" },
  );
  assert.equal(mediaRequestSchema.safeParse({ folderPath: "", path: "weekly.m4a" }).success, false);
});

test("media transcript responses validate timestamped source evidence", () => {
  const response = mediaTranscriptResponseSchema.parse({
    status: "ready",
    transcript: {
      createdAt: "2026-09-04T08:00:00.000Z",
      language: "en",
      provider: { id: "local", model: "small", version: "1" },
      schemaVersion: 1,
      segments: [{ endMs: 2_500, id: 0, startMs: 1_000, text: "First result" }],
      source: {
        contentHash: "a".repeat(64),
        durationMs: 60_000,
        mtimeMs: 1,
        size: 20,
        statIdentity: "stat:source",
      },
    },
  });
  assert.equal(response.status, "ready");
  assert.equal(
    mediaTranscriptResponseSchema.safeParse({
      status: "ready",
      transcript: {
        createdAt: "now",
        language: "en",
        provider: { id: "local", model: "small", version: "1" },
        schemaVersion: 1,
        segments: [{ endMs: 100, id: 0, startMs: 200, text: "Backwards" }],
        source: {
          contentHash: "b".repeat(64),
          durationMs: 1,
          mtimeMs: 1,
          size: 1,
          statIdentity: "stat",
        },
      },
    }).success,
    false,
  );
});

test("media progress and cancellation responses reject unowned fields", () => {
  assert.deepEqual(mediaPreviewStatusSchema.parse({ status: "queued", tasksAhead: 2 }), {
    status: "queued",
    tasksAhead: 2,
  });
  assert.equal(
    mediaPreviewStatusSchema.safeParse({ status: "converting", percent: 140 }).success,
    false,
  );
  assert.equal(
    mediaCancelResponseSchema.safeParse({ cancelled: true, ok: true, path: "/private/file" })
      .success,
    false,
  );
});
