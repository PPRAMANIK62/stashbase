/**
 * Polyfill `Map.prototype.getOrInsert` / `getOrInsertComputed` (the TC39
 * "upsert" proposal). pdfjs 5.7 calls `getOrInsertComputed` in its render
 * path but ships no polyfill; Electron 39's V8 (Chromium ~140) hasn't
 * shipped the method yet, so `page.render()` throws
 * `this[#methodPromises].getOrInsertComputed is not a function` and the
 * canvas stays blank. (Node 26's V8 has it, which is why nothing failed
 * server-side.) Importing this module installs the method on both the
 * main thread and the pdf worker scope — see `pdfWorker.ts`.
 *
 * Remove once Electron's bundled Chromium ships native Map upsert.
 */
type AnyMap = Map<unknown, unknown> & {
  getOrInsert?: (key: unknown, value: unknown) => unknown;
  getOrInsertComputed?: (key: unknown, fn: (key: unknown) => unknown) => unknown;
};

function install(proto: AnyMap): void {
  if (typeof proto.getOrInsertComputed !== 'function') {
    Object.defineProperty(proto, 'getOrInsertComputed', {
      value(this: Map<unknown, unknown>, key: unknown, fn: (key: unknown) => unknown) {
        if (this.has(key)) return this.get(key);
        const v = fn(key);
        this.set(key, v);
        return v;
      },
      writable: true,
      configurable: true,
    });
  }
  if (typeof proto.getOrInsert !== 'function') {
    Object.defineProperty(proto, 'getOrInsert', {
      value(this: Map<unknown, unknown>, key: unknown, value: unknown) {
        if (this.has(key)) return this.get(key);
        this.set(key, value);
        return value;
      },
      writable: true,
      configurable: true,
    });
  }
}

install(Map.prototype as AnyMap);
install(WeakMap.prototype as unknown as AnyMap);
