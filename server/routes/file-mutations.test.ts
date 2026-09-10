import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import express from "express";

import { clearCurrentFolder, removeRecent, setCurrentFolder } from "../folder.ts";
import { mount as mountFiles } from "./files.ts";
import { mount as mountFolders } from "./folders.ts";

async function listen(app: express.Express): Promise<{ origin: string; close(): Promise<void> }> {
  const server = http.createServer(app);
  server.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test("entry mutations honor an explicit folder that names the active folder and refuse any other", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stashbase-entry-mutations-"));
  const other = fs.mkdtempSync(path.join(os.tmpdir(), "stashbase-entry-other-"));
  fs.writeFileSync(path.join(root, "keep.md"), "# Keep\n", "utf8");
  setCurrentFolder(root);

  const app = express();
  app.use(express.json());
  mountFiles(app);
  mountFolders(app);
  const server = await listen(app);
  const explicit = `?folder=${encodeURIComponent(root)}`;
  const foreign = `?folder=${encodeURIComponent(other)}`;
  const json = { "content-type": "application/json" };

  try {
    const created = await fetch(`${server.origin}/api/files${explicit}`, {
      body: JSON.stringify({ dir: "", name: "Plan" }),
      headers: json,
      method: "POST",
    });
    assert.equal(created.status, 200);
    assert.equal(((await created.json()) as { name: string }).name, "Plan.md");
    assert.ok(fs.existsSync(path.join(root, "Plan.md")));

    const folder = await fetch(`${server.origin}/api/folders${explicit}`, {
      body: JSON.stringify({ path: "drafts" }),
      headers: json,
      method: "POST",
    });
    assert.equal(folder.status, 200);
    assert.ok(fs.statSync(path.join(root, "drafts")).isDirectory());

    for (const request of [
      { method: "POST", path: `/api/files${foreign}`, body: { name: "Foreign" } },
      { method: "POST", path: `/api/folders${foreign}`, body: { path: "foreign" } },
      { method: "PATCH", path: `/api/files/keep.md${foreign}`, body: { new_name: "Moved" } },
      { method: "DELETE", path: `/api/files/keep.md${foreign}` },
      { method: "PATCH", path: `/api/folders/drafts${foreign}`, body: { new_name: "moved" } },
      { method: "DELETE", path: `/api/folders/drafts${foreign}` },
    ]) {
      const refused = await fetch(`${server.origin}${request.path}`, {
        body: request.body ? JSON.stringify(request.body) : undefined,
        headers: json,
        method: request.method,
      });
      assert.equal(refused.status, 409, `${request.method} ${request.path}`);
      assert.equal(((await refused.json()) as { code: string }).code, "FOLDER_CHANGED");
    }
    assert.ok(fs.existsSync(path.join(root, "keep.md")));
    assert.ok(fs.existsSync(path.join(root, "drafts")));
    assert.equal(fs.existsSync(path.join(root, "Foreign.md")), false);
    assert.equal(fs.existsSync(path.join(other, "Foreign.md")), false);
  } finally {
    await server.close();
    clearCurrentFolder();
    removeRecent(root);
    fs.rmSync(root, { force: true, recursive: true, maxRetries: 10, retryDelay: 100 });
    fs.rmSync(other, { force: true, recursive: true, maxRetries: 10, retryDelay: 100 });
  }
});
