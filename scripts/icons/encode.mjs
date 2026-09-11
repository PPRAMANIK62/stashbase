// The pure half of the icon build: which stroke weights a raster size gets,
// the SVG variant that produces, and the ICO and ICNS containers. Nothing
// here touches Electron, so it runs under node:test; render.mjs rasterises.

/** Edge of the master raster, in pixels. Every size is resampled from one. */
export const MASTER_SIZE = 1024;

/** Standalone PNGs; electron-builder reads the directory for Linux. */
export const PNG_SIZES = [16, 32, 48, 64, 128, 256, 512];

/** Frames of the Windows icon. */
export const ICO_SIZES = [16, 32, 48, 64, 128, 256];

/** Entries of the macOS icon: the ICNS type code and the pixel edge it holds.
 *  The 1x and 2x forms of one point size are separate entries, so 32 px
 *  appears as both 32@1x (`icp5`) and 16@2x (`ic11`). */
export const ICNS_ENTRIES = [
  ["icp4", 16],
  ["ic11", 32],
  ["icp5", 32],
  ["ic12", 64],
  ["ic07", 128],
  ["ic13", 256],
  ["ic08", 256],
  ["ic14", 512],
  ["ic09", 512],
  ["ic10", 1024],
];

/** The mark's own stroke widths, in the SVG's 512 viewBox: the ink S and the
 *  gray frame. This is what build/icon.svg carries and what every raster from
 *  64 px up is drawn with. */
export const SOURCE_WEIGHTS = { frame: 24, ink: 32 };

/** Stroke widths for a raster of the given edge. From 64 px up the mark keeps
 *  its own weights. Below that a 30° stroke of one or two pixels smears across
 *  the grid and the S dissolves, so the small sizes are drawn heavier, the way
 *  a typeface carries an optical size. */
export function strokeWeights(size) {
  if (size <= 16) return { frame: 40, ink: 56 };
  if (size <= 32) return { frame: 36, ink: 48 };
  if (size <= 48) return { frame: 32, ink: 40 };
  return { ...SOURCE_WEIGHTS };
}

/** The source SVG redrawn at the given weights. The source is the one place
 *  the mark's geometry lives, so this rewrites only the two stroke widths it
 *  expects to find there, exactly once each, and refuses anything else. */
export function weightedSvg(svg, { frame, ink }) {
  const seen = { frame: 0, ink: 0 };
  const rewritten = svg.replace(/stroke-width="(\d+)"/gu, (match, width) => {
    if (Number(width) === SOURCE_WEIGHTS.ink) {
      seen.ink += 1;
      return `stroke-width="${ink}"`;
    }
    if (Number(width) === SOURCE_WEIGHTS.frame) {
      seen.frame += 1;
      return `stroke-width="${frame}"`;
    }
    return match;
  });
  if (seen.ink !== 1 || seen.frame !== 1) {
    throw new Error(
      `the icon source must carry exactly one stroke-width="${SOURCE_WEIGHTS.ink}" (ink) and one stroke-width="${SOURCE_WEIGHTS.frame}" (frame); found ${seen.ink} and ${seen.frame}`,
    );
  }
  return rewritten;
}

/** A Windows icon holding the given PNG frames, smallest first. Each frame is
 *  stored as PNG, which Windows has read since Vista and which keeps the
 *  alpha the rounded corners need. */
export function encodeIco(frames) {
  const ordered = [...frames].sort((a, b) => a.size - b.size);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(ordered.length, 4);
  let offset = header.length + 16 * ordered.length;
  const directory = ordered.map(({ png, size }) => {
    const entry = Buffer.alloc(16);
    // A 256 px frame is written as 0: the field is one byte.
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...directory, ...ordered.map(({ png }) => png)]);
}

/** A macOS icon holding the given PNG entries, each under its ICNS type. */
export function encodeIcns(entries) {
  const chunks = entries.map(({ png, type }) => {
    const head = Buffer.alloc(8);
    head.write(type, 0, 4, "ascii");
    head.writeUInt32BE(png.length + head.length, 4);
    return Buffer.concat([head, png]);
  });
  const body = Buffer.concat(chunks);
  const head = Buffer.alloc(8);
  head.write("icns", 0, 4, "ascii");
  head.writeUInt32BE(body.length + head.length, 4);
  return Buffer.concat([head, body]);
}
