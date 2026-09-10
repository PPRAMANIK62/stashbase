// pdf.js calls two proposals Electron's bundled Chromium does not ship yet.
// Both polyfills are installed structurally so nothing here has to widen or
// re-declare a global type.

/** What `Map.prototype` and `WeakMap.prototype` both offer, plus the upsert
 *  helpers pdf.js expects to find on them. */
interface UpsertHost {
  get(key: unknown): unknown;
  getOrInsert?: (key: unknown, value: unknown) => unknown;
  getOrInsertComputed?: (key: unknown, create: (key: unknown) => unknown) => unknown;
  has(key: unknown): boolean;
  set(key: unknown, value: unknown): unknown;
}

function installMapUpsert(prototype: UpsertHost): void {
  if (typeof prototype.getOrInsertComputed !== 'function') {
    Object.defineProperty(prototype, 'getOrInsertComputed', {
      configurable: true,
      value(this: UpsertHost, key: unknown, create: (key: unknown) => unknown) {
        if (this.has(key)) return this.get(key);
        const value = create(key);
        this.set(key, value);
        return value;
      },
      writable: true,
    });
  }
  if (typeof prototype.getOrInsert !== 'function') {
    Object.defineProperty(prototype, 'getOrInsert', {
      configurable: true,
      value(this: UpsertHost, key: unknown, value: unknown) {
        if (this.has(key)) return this.get(key);
        this.set(key, value);
        return value;
      },
      writable: true,
    });
  }
}

installMapUpsert(Map.prototype);
installMapUpsert(WeakMap.prototype);

/** `Math.sumPrecise` is a stage-3 proposal; the host is described locally
 *  rather than by augmenting the global `Math` interface. */
interface SumPreciseHost {
  abs(value: number): number;
  sumPrecise?: (values: Iterable<number>) => number;
}

const mathHost: SumPreciseHost = Math;

if (typeof mathHost.sumPrecise !== 'function') {
  Object.defineProperty(Math, 'sumPrecise', {
    configurable: true,
    value(values: Iterable<number>) {
      let sum = 0;
      let compensation = 0;
      for (const value of values) {
        const next = sum + value;
        compensation += Math.abs(sum) >= Math.abs(value) ? sum - next + value : value - next + sum;
        sum = next;
      }
      return sum + compensation;
    },
    writable: true,
  });
}
