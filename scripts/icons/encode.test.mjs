import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { iconBuildEnvironment } from "./build.mjs";
import {
  encodeIcns,
  encodeIco,
  ICNS_ENTRIES,
  ICO_SIZES,
  MASTER_SIZE,
  PNG_SIZES,
  SOURCE_WEIGHTS,
  strokeWeights,
  weightedSvg,
} from "./encode.mjs";

const iconSource = readFileSync(new URL("../../build/icon.svg", import.meta.url), "utf8");

function fakePng(size) {
  // Only the container is under test; a tagged buffer stands in for a PNG.
  return Buffer.from(`png-${size}-`.padEnd(size, "x"));
}

test("the icon source carries the mark's own weights", () => {
  assert.match(iconSource, new RegExp(`stroke-width="${SOURCE_WEIGHTS.ink}"`, "u"));
  assert.match(iconSource, new RegExp(`stroke-width="${SOURCE_WEIGHTS.frame}"`, "u"));
  assert.deepEqual(strokeWeights(MASTER_SIZE), SOURCE_WEIGHTS);
});

test("small rasters are drawn heavier and 64 px up keeps the source weights", () => {
  assert.deepEqual(strokeWeights(16), { frame: 40, ink: 56 });
  assert.deepEqual(strokeWeights(32), { frame: 36, ink: 48 });
  assert.deepEqual(strokeWeights(48), { frame: 32, ink: 40 });
  for (const size of [64, 128, 256, 512, 1024]) {
    assert.deepEqual(strokeWeights(size), SOURCE_WEIGHTS, `${size}`);
  }
  // Heavier means heavier at every step down, for both strokes.
  const steps = [64, 48, 32, 16].map((size) => strokeWeights(size));
  for (let i = 1; i < steps.length; i += 1) {
    assert.ok(steps[i].ink > steps[i - 1].ink);
    assert.ok(steps[i].frame > steps[i - 1].frame);
  }
});

test("a weighted variant rewrites exactly the two source strokes", () => {
  const variant = weightedSvg(iconSource, { frame: 36, ink: 48 });
  assert.equal(variant.match(/stroke-width="48"/gu)?.length, 1);
  assert.equal(variant.match(/stroke-width="36"/gu)?.length, 1);
  assert.doesNotMatch(variant, /stroke-width="32"/u);
  assert.doesNotMatch(variant, /stroke-width="24"/u);
  // Everything but the two widths is untouched.
  assert.equal(
    variant.replace(/stroke-width="\d+"/gu, ""),
    iconSource.replace(/stroke-width="\d+"/gu, ""),
  );
  // The source weights reproduce the source.
  assert.equal(weightedSvg(iconSource, SOURCE_WEIGHTS), iconSource);
});

test("a source without the expected strokes is refused", () => {
  assert.throws(() => weightedSvg('<svg><path stroke-width="10"/></svg>', { frame: 1, ink: 2 }), {
    message: /exactly one stroke-width="32"/u,
  });
  assert.throws(
    () => weightedSvg(iconSource.replace('stroke-width="24"', 'stroke-width="32"'), { frame: 1, ink: 2 }),
    { message: /found 2 and 0/u },
  );
});

test("the ICO directory addresses every frame, smallest first", () => {
  const frames = [256, 16, 48].map((size) => ({ png: fakePng(size), size }));
  const ico = encodeIco(frames);

  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  const expected = [16, 48, 256];
  let offset = 6 + 16 * 3;
  expected.forEach((size, index) => {
    const entry = 6 + 16 * index;
    const png = fakePng(size);
    assert.equal(ico.readUInt8(entry), size >= 256 ? 0 : size);
    assert.equal(ico.readUInt8(entry + 1), size >= 256 ? 0 : size);
    assert.equal(ico.readUInt16LE(entry + 4), 1);
    assert.equal(ico.readUInt16LE(entry + 6), 32);
    assert.equal(ico.readUInt32LE(entry + 8), png.length);
    assert.equal(ico.readUInt32LE(entry + 12), offset);
    assert.deepEqual(ico.subarray(offset, offset + png.length), png);
    offset += png.length;
  });
  assert.equal(ico.length, offset);
});

test("the ICNS container wraps each entry under its type with big-endian lengths", () => {
  const entries = [
    { png: fakePng(16), type: "icp4" },
    { png: fakePng(32), type: "ic11" },
  ];
  const icns = encodeIcns(entries);

  assert.equal(icns.subarray(0, 4).toString("ascii"), "icns");
  assert.equal(icns.readUInt32BE(4), icns.length);
  let cursor = 8;
  for (const { png, type } of entries) {
    assert.equal(icns.subarray(cursor, cursor + 4).toString("ascii"), type);
    assert.equal(icns.readUInt32BE(cursor + 4), png.length + 8);
    assert.deepEqual(icns.subarray(cursor + 8, cursor + 8 + png.length), png);
    cursor += png.length + 8;
  }
  assert.equal(cursor, icns.length);
});

test("the size tables agree with each other", () => {
  assert.deepEqual([...ICO_SIZES].sort((a, b) => a - b), ICO_SIZES);
  for (const size of ICO_SIZES) assert.ok(PNG_SIZES.includes(size), `${size}`);
  const types = ICNS_ENTRIES.map(([type]) => type);
  assert.equal(new Set(types).size, types.length);
  for (const [type, size] of ICNS_ENTRIES) {
    assert.equal(type.length, 4);
    assert.ok(size <= MASTER_SIZE, type);
  }
});

test("the render launches Electron without inheriting embedded Node mode", () => {
  const environment = iconBuildEnvironment({ ELECTRON_RUN_AS_NODE: "1", EXISTING: "kept" });
  assert.equal(environment.EXISTING, "kept");
  assert.equal(environment.ELECTRON_RUN_AS_NODE, undefined);
});

test("the icon build is wired into package.json", () => {
  const packageJson = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  );
  assert.equal(packageJson.scripts["build:icons"], "node scripts/icons/build.mjs");
  assert.equal(packageJson.build.icon, "build/icon");
  assert.equal(packageJson.build.linux.icon, "build/icons");
});
