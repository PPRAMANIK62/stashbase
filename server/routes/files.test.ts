import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import express from "express";

import { fileVersion } from "../files.ts";
import { clearCurrentFolder, removeRecent, setCurrentFolder } from "../folder.ts";
import { mount } from "./files.ts";

test("versioned document route accepts JSON through the shared source authority", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stashbase-json-route-"));
  const source = '\uFEFF{\r\n  "value": 1\r\n}\r\n';
  fs.writeFileSync(path.join(root, "data.json"), source, "utf8");
  setCurrentFolder(root);

  const app = express();
  app.use(express.json());
  mount(app);
  const server = http.createServer(app);
  server.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/files/data.json?folder=${encodeURIComponent(root)}`,
      {
        body: JSON.stringify({
          baseVersion: fileVersion("data.json"),
          content: '\uFEFF{\n  "value": 2\n}\n',
        }),
        headers: { "content-type": "application/json" },
        method: "PUT",
      },
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(body.format, "json");
    assert.equal(body.name, "data.json");
    assert.equal(body.content, '\uFEFF{\r\n  "value": 2\r\n}\r\n');
    assert.equal(fs.readFileSync(path.join(root, "data.json"), "utf8"), body.content);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    clearCurrentFolder();
    removeRecent(root);
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("reveal resolves the requested registered folder and rejects an unregistered folder", async () => {
  const activeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "stashbase-reveal-active-"));
  const memberRoot = fs.mkdtempSync(path.join(os.tmpdir(), "stashbase-reveal-member-"));
  const outsiderRoot = fs.mkdtempSync(path.join(os.tmpdir(), "stashbase-reveal-outsider-"));
  const memberSource = path.join(memberRoot, "source.ts");
  fs.writeFileSync(memberSource, "export const answer = 42;\n", "utf8");
  setCurrentFolder(memberRoot);
  setCurrentFolder(activeRoot);

  const revealed: string[] = [];
  const app = express();
  app.use(express.json());
  mount(app, { revealInFileManager: (absolutePath) => revealed.push(absolutePath) });
  const server = http.createServer(app);
  server.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");

  try {
    const revealedResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/reveal/source.ts?folder=${encodeURIComponent(memberRoot)}`,
      { method: "POST" },
    );
    assert.equal(revealedResponse.status, 200);
    assert.deepEqual(revealed, [memberSource]);

    const rejectedResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/reveal/source.ts?folder=${encodeURIComponent(outsiderRoot)}`,
      { method: "POST" },
    );
    assert.equal(rejectedResponse.status, 400);
    assert.deepEqual(revealed, [memberSource]);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    clearCurrentFolder();
    removeRecent(activeRoot);
    removeRecent(memberRoot);
    fs.rmSync(activeRoot, { force: true, recursive: true });
    fs.rmSync(memberRoot, { force: true, recursive: true });
    fs.rmSync(outsiderRoot, { force: true, recursive: true });
  }
});
