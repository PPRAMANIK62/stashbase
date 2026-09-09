// Shared test environment: what happy-dom lacks and every component test
// used to stub for itself. Builders and fakes live beside this file.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// happy-dom ships no Web Animations API, so `Element.prototype.getAnimations`
// is absent. Overlay primitives call it while closing to wait for an exit
// animation; without it every dialog, dropdown, and popover test throws.
// Real animations never run headless, so an empty list is the honest answer.
if (!('getAnimations' in Element.prototype)) {
  Object.defineProperty(Element.prototype, 'getAnimations', {
    configurable: true,
    writable: true,
    value(): Animation[] {
      return [];
    },
  });
}

// Everything else the tests used to stub — `matchMedia`, `ResizeObserver`,
// `scrollIntoView`, `IntersectionObserver`, `URL.createObjectURL` — happy-dom
// does implement. A test that needs a specific answer from one of them (a
// compact viewport, an observed resize, a deterministic object URL) stubs it
// locally through the helpers in `./dom`, rather than globally here.

// Every date and time a reader sees is formatted for their own locale, which
// the code deliberately never names. A test that wants a literal string has to
// know which locale produced it, so the suite pins one: only a call that asked
// for the runtime default is redirected, and a test that names a locale of its
// own still gets it. Without this, an assertion would either be tautological —
// comparing a label against the formatter that made it — or fail on a machine
// configured for another language.
const TEST_LOCALE = 'en-US';

function pinLocale<Method extends 'toLocaleDateString' | 'toLocaleString' | 'toLocaleTimeString'>(
  method: Method,
): void {
  const format = Date.prototype[method];
  Date.prototype[method] = function pinned(
    this: Date,
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions,
  ): string {
    const wantsRuntimeDefault =
      locales === undefined || (Array.isArray(locales) && locales.length === 0);
    return format.call(this, wantsRuntimeDefault ? TEST_LOCALE : locales, options);
  };
}

pinLocale('toLocaleDateString');
pinLocale('toLocaleString');
pinLocale('toLocaleTimeString');
