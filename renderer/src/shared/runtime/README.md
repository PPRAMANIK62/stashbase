# `shared/runtime`

**Application plumbing**: hooks and providers that no kit primitive consumes,
only `app/` composition and feature hooks — request signal lifetimes, lazily
mounted surfaces, command-surface registration, runtime scoping and retention,
scroll anchoring, text-entry focus tracking, and the provider stack the
application mounts.

It sits under `shared/` rather than `lib/` because `lib/` is the installed
Fluid registry and this is product code. The dependency runs one way: a module
here may import from the kit (`lib/`, `components/`), and no module in the kit
may import from here. That is what keeps the kit installable without the
application, and `kit-does-not-reach-product-code` in
`dependency-cruiser.config.cjs` is what holds it.
