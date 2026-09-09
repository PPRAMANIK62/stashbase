# `lib/runtime`

`lib/` is two layers, and this directory is the second one.

At the `lib/` root sits **kit infrastructure**: the token contexts, the
geometry and motion primitives, and the hooks the components in
`components/ui` and `components/internal` are built out of. Everything there
is reachable from a primitive, and a primitive never reaches past it.

Under `lib/runtime/` sits **application plumbing**: hooks and providers that
no component consumes, only `app/` composition and feature hooks — request
signal lifetimes, lazily-mounted surfaces, command-surface registration,
runtime scoping and retention, scroll anchoring, text-entry focus tracking,
and the provider stack the application mounts.

The split is a dependency rule, not a filing preference: a module here may
import from the `lib/` root, and a module at the `lib/` root may not import
from here. That is what keeps the kit installable without the application.
