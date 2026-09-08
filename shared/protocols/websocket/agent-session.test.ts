import assert from "node:assert/strict";
import test from "node:test";

import {
  agentClientEventSchema,
  agentServerEventSchema,
  agentSessionConnectSchema,
} from "./agent-session.ts";

test("agent socket schemas accept lifecycle, transcript, and scope-retirement events", () => {
  for (const event of [
    { t: "ready" },
    { t: "session-id", id: "native-1" },
    { t: "text", delta: "hello" },
    { t: "exit", reason: "scope-removed", folder: "/library/project" },
  ]) {
    assert.equal(agentServerEventSchema.safeParse(event).success, true);
  }
  assert.deepEqual(agentClientEventSchema.parse({ t: "close" }), { t: "close" });
});

test("agent socket schemas reject contradictory scope and unrecognized wire events", () => {
  assert.equal(
    agentSessionConnectSchema.safeParse({
      agent: "codex",
      access: "auto",
      folder: "/library/project",
      scope: "library",
    }).success,
    false,
  );
  assert.equal(agentServerEventSchema.safeParse({ t: "mystery" }).success, false);
  assert.equal(agentClientEventSchema.safeParse({ t: "close", extra: true }).success, false);
  assert.equal(
    agentSessionConnectSchema.safeParse({ agent: "codex", access: "auto" }).success,
    false,
  );
});
