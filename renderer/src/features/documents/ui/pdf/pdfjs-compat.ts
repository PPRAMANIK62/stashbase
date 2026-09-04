// oxlint-disable-next-line no-unused-vars -- ambient declaration types the runtime polyfill below
interface Math {
  sumPrecise?: (values: Iterable<number>) => number;
}

type UpsertMap = Map<unknown, unknown> & {
  getOrInsert?: (key: unknown, value: unknown) => unknown;
  getOrInsertComputed?: (key: unknown, create: (key: unknown) => unknown) => unknown;
};

function installMapUpsert(prototype: UpsertMap): void {
  if (typeof prototype.getOrInsertComputed !== 'function') {
    Object.defineProperty(prototype, 'getOrInsertComputed', {
      configurable: true,
      value(this: Map<unknown, unknown>, key: unknown, create: (key: unknown) => unknown) {
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
      value(this: Map<unknown, unknown>, key: unknown, value: unknown) {
        if (this.has(key)) return this.get(key);
        this.set(key, value);
        return value;
      },
      writable: true,
    });
  }
}

installMapUpsert(Map.prototype as UpsertMap);
installMapUpsert(WeakMap.prototype as unknown as UpsertMap);

if (typeof Math.sumPrecise !== 'function') {
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
