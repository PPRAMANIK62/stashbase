import assert from "node:assert/strict";
import test from "node:test";

import {
  agentSessionListResponseSchema,
  agentSessionRenameRequestSchema,
  agentSessionReplaySchema,
} from "./agent-sessions.ts";

test("agent session history accepts scoped rows and protocol-v2 replay", () => {
  assert.deepEqual(
    agentSessionListResponseSchema.parse([
      {
        id: "session-1",
        title: "Research notes",
        lastModified: 1_725_000_000_000,
        hasContent: true,
        folder: "/library/research",
      },
    ]),
    [
      {
        id: "session-1",
        title: "Research notes",
        lastModified: 1_725_000_000_000,
        hasContent: true,
        folder: "/library/research",
      },
    ],
  );

  assert.equal(
    agentSessionReplaySchema.parse({
      protocol: 2,
      effort: null,
      messages: [
        { kind: "user", id: "user-1", text: "Summarize this folder." },
        { kind: "assistant", id: "assistant-1", text: "Here is the summary." },
        {
          kind: "tool",
          id: "tool-1",
          name: "Read",
          input: { path: "notes.md" },
          status: "done",
        },
      ],
    }).messages.length,
    3,
  );
});

test("agent session history rejects malformed identities, versions, and rename payloads", () => {
  assert.equal(
    agentSessionListResponseSchema.safeParse([
      { id: "", title: "Invalid", lastModified: Date.now() },
    ]).success,
    false,
  );
  assert.equal(
    agentSessionListResponseSchema.safeParse([
      { id: "missing-content-state", title: "Invalid", lastModified: Date.now() },
    ]).success,
    false,
  );
  assert.equal(
    agentSessionReplaySchema.safeParse({ protocol: 1, effort: null, messages: [] }).success,
    false,
  );
  assert.equal(agentSessionRenameRequestSchema.safeParse({ title: "   " }).success, false);
});
