// Regenerates the application icon set from build/icon.svg.
//
// Electron does the rasterising (render.mjs), so this launcher hands it a
// clean environment: an inherited ELECTRON_RUN_AS_NODE would turn the binary
// into plain Node and the render would never start. Run it on a machine with
// a display session; the rasters and containers it writes are checked in.

import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import electronPath from "electron";

export function iconBuildEnvironment(baseEnvironment = process.env) {
  const environment = { ...baseEnvironment };
  delete environment.ELECTRON_RUN_AS_NODE;
  return environment;
}

export function runIconBuild() {
  const render = fileURLToPath(new URL("./render.mjs", import.meta.url));
  return new Promise((resolve) => {
    const child = spawn(electronPath, [render], {
      env: iconBuildEnvironment(),
      stdio: "inherit",
    });
    child.on("error", (error) => {
      console.error(error);
      resolve(1);
    });
    child.on("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runIconBuild();
}
