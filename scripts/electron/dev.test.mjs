import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { developmentElectronEnvironment } from "./dev.mjs";

test("the default development command includes the Electron host", () => {
  const packageJson = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  );

  assert.match(packageJson.scripts.dev, /npm:dev:desktop/u);
  assert.equal(packageJson.scripts["dev:desktop"], "node scripts/electron/dev.mjs");
});

test("the development Electron host enables Vite without inheriting embedded Node mode", () => {
  const environment = developmentElectronEnvironment({
    ELECTRON_RUN_AS_NODE: "1",
    EXISTING: "kept",
  });

  assert.equal(environment.STASHBASE_DEV_VITE, "1");
  assert.equal(environment.EXISTING, "kept");
  assert.equal(environment.ELECTRON_RUN_AS_NODE, undefined);
});
