# Renderer Architecture

> Engineering contract for the replacement renderer during the migration: the
> layer model, the vocabulary a reviewer is expected to recognize, and every
> rule a machine enforces. Permanent contracts under `code-review/` describe
> Shipping behavior and are not edited while the replacement is under
> construction, so this file is the renderer's owning contract until cutover.

## Scope and Ownership

This contract covers everything under `renderer/src` plus the tooling that
polices it. It governs where a module may live, what it may import, how large
it may grow, and what evidence proves it. It does not restate product intent —
that stays in the migration [Target Architecture](../architecture.md) — and it
does not restate general coding rules, which live in
[Engineering Standards](engineering.md).

The renderer is one Vite application composed by `app`. Everything else is a
layer with a single reason to exist, and the direction of dependency is the
whole design: outer layers know inner ones, never the reverse.

## Layer Model

- **`app`** composes. It owns providers, routing, dependency wiring, workflows
  that span features, and shell composition. It is the only layer allowed to
  import a feature's `public.ts`.
- **`features/<name>`** is a product capability, isolated from its siblings.
  Each feature is exactly these entries:
  - `domain` — pure values, state transitions, identities, and recovery plans.
    No React, no DOM, no Node, no transport.
  - `application` — Ports, Runtimes, and command orchestration expressed
    against those Ports. It selects no adapter and renders nothing.
  - `infrastructure` — Adapters that implement the Ports: transport calls, wire
    validation, and the mapping from wire types to feature types.
  - `hooks` — React adaptation of application capabilities into view models.
  - `ui` — views, which invoke capabilities and never reach a transport.
  - `public.ts` — the only entry other code may import.
  - `test-support.ts` — optional, and the one exception to `public.ts`: it
    builds the feature's real runtime over fakes so a suite does not rebuild
    the wiring. Only a `*.test.*` file may import it.
- **`lib`** is the installed Fluid registry exactly as the installer emits
  it: token contexts, geometry and motion primitives, and the hooks
  `components/ui` and `components/internal` are built out of. A registry
  test keeps the `lib` root equal to the manifest, so nothing local lands
  where a reinstall would overwrite it. Local kit extensions that only
  components consume live under `lib/local`. The dependency runs one way:
  `lib` and `components` may reach `shared/utils` and nothing else under
  `shared`, which is what keeps the kit installable without the application.
- **`shared`** is a leaf. It holds `shared/domain` and `shared/utils`, both
  pure; `shared/runtime`, the application plumbing (request-signal
  lifetimes, lazily mounted surfaces, command-surface registration, runtime
  scoping and retention, scroll anchoring, text-entry focus, and the
  provider stack the application mounts); `shared/ui` and `shared/styling`
  for browser-facing shared code such as the clipboard helper and code
  highlighting; and `shared/brand`, which is artwork. Nothing in `shared`
  may reach `app`, `features`, or `platform`.
- **`platform`** owns mechanism at the host boundary — the typed preload
  bridge and API client — with no product policy.
- **`components/ui`** is the installed Fluid primitive layer. Product code
  consumes it; it consumes nothing from product code.
- **`test`** is the shared test toolkit, described under Validation.

A feature directory that is not declared in `renderer/renderer-architecture.json`
with an owning product area does not exist as far as the gates are concerned.

## Vocabulary

A reviewer should be able to infer a module's role from its name.

- **Port** — an interface declared in a feature's `application` layer naming a
  capability the feature needs. Ports are abstract; they never mention a URL,
  a schema, or `window`.
- **Adapter** — an `infrastructure` factory that implements a Port. Adapters
  own wire validation and translate wire failures into the feature's error
  kinds; they are the only place `@/protocols/*` may be imported.
- **Contract** — a repository module under `shared/` at the repository root
  that the renderer shares with the host process, reached through
  `@/contracts/*`: `file-formats`, `html-sanitization`, `agent-runtime`,
  `agent-protocol`, and `account`. A Contract is registered in
  `renderer/renderer-architecture.json` and mapped where the renderer meets
  the host — a feature Adapter, `platform`, or `app/dependencies.ts` — for the
  same reason a wire schema is. `@/contracts/*` is its own alias precisely so
  that it is not mistaken for `@/shared/*`, which is the renderer's own leaf
  kernel under `renderer/src/shared`.
- **Runtime** — an `application` orchestrator that sequences commands over
  Ports and a store, for example `document-runtime` and `tabs-runtime`.
- **`capture()` / `accept()`** — the scope guard a Runtime exposes. A caller
  captures the current scope before awaiting, and the Runtime accepts a
  completion only while that captured scope is still current. Every
  asynchronous completion in the renderer passes through this pair rather than
  through an ad-hoc generation counter.
- **`failureMessage`** — one module per feature, at
  `features/<name>/application/failure-messages.ts`, that turns a failure kind
  into the sentence a reader sees. Views select recovery by kind and take their
  wording from this module, so a message is written once. The name and the
  layer are both fixed: a reviewer looking for a feature's wording opens one
  path, not three spellings.
- **`FeatureError`** — the single error base in
  `renderer/src/shared/domain/feature-error.ts`. It carries a `name` for the
  failing capability and a `kind` that selects recovery. The shared transport
  kinds are `invalid-response`, `scope-lost`, `unauthorized`, and
  `unavailable`; a feature extends that union with outcomes only it can meet.
- **Registry** — the one table that makes a variant addable in a single place:
  the document-viewer registry in
  `renderer/src/features/documents/ui/source/registry.tsx`, the search backends
  in `renderer/src/features/retrieval/ui/search/backends.ts`. Adding a format
  or a search mode is an entry plus its module; nothing else may test the
  variant by name.

## Enforced Rules

Every rule below is enforced by a command, not by review attention. A rule that
cannot be run is not part of this contract.

**Dependency direction — dependency-cruiser (`dependency-cruiser.config.cjs`).**
Twenty rules, all `error`: `no-circular`, `not-to-unresolvable`,
`no-sibling-feature-imports`, `feature-public-entry-only`,
`test-support-is-test-only`, `feature-public-only-from-app`, `domain-is-pure`,
`domain-has-no-node-access`, `application-depends-inward`,
`hooks-have-no-platform-or-view-access`, `ui-has-no-platform-access`,
`infrastructure-has-no-ui-or-app-policy`, `platform-has-no-product-policy`,
`shared-is-a-leaf`, `shared-domain-and-utils-are-pure`,
`kit-does-not-reach-application-plumbing`,
`contracts-are-mapped-at-the-boundary`, `file-format-vocabulary-scope`,
`renderer-does-not-import-implementation-trees`, and
`renderer-does-not-import-electron-runtime`.

The cruiser reads the transpiled graph, where `import type` has been erased,
so it proves the value-level graph only. A Contract is imported for its types
more often than for its values, so the same boundary is held over the source
text by the layout checker below; the cruiser rule is what catches a value
import and what states the boundary in the dependency contract.

**Layout and repository registries — `scripts/renderer/architecture.mjs`.**
`renderer/renderer-architecture.json` is the only feature allowlist — the
checker holds no second copy to drift from it. Every feature directory is
declared there with its product area; a feature contains only the seven
approved entries (`domain`, `application`, `infrastructure`, `hooks`, `ui`,
`public.ts`, and the optional `test-support.ts`) and always a `public.ts`;
`renderer/src/shared/types` is forbidden; no file references `web-src`,
`../server/`, or `../electron/`; and no import is parent-relative — `./` or
`@/` only.

The same file carries the two registries of repository modules the renderer
may reach, and both are checked over the source text, so a type-only import
counts: `wireSchemaModules` for the executable schemas reached through
`@/protocols/*`, and `contractModules` for the Contracts reached through
`@/contracts/*`. An unregistered module fails; so does reaching a module
registered in one list through the other list's alias. A Contract import
outside the host boundary — `features/*/infrastructure`, `platform`, or
`app/dependencies.ts` — fails too, with one named exception:
`shared/file-formats` is a vocabulary rather than a transport shape, so
`renderer/src/shared` may restate it.

**Layer purity inside a file — oxlint overrides (`.oxlintrc.json`).** Domain,
application, hooks, and UI each forbid the globals that would let them bypass
their layer (DOM, transports, storage), forbid the imports their layer may not
name, and forbid `@/protocols/*` so wire types are mapped in `infrastructure`.
UI additionally forbids `window.stashbase`, `window.electron`, and
`window.ipcRenderer`. Test files forbid `setTimeout` and `setInterval` — a test
awaits a condition or uses fake timers — and forbid the `toHaveClass` matcher
except under `renderer/src/components/ui`, where a class is the primitive's
observable contract. `typescript/no-non-null-assertion` is an error, so `!`
never stands in for a narrow. `react/exhaustive-deps` and
`react/rules-of-hooks` are errors: the `correctness` category carries neither,
so without its own entry a conditionally called hook lints clean — which is
how a conditional `useContext` shipped. Twelve `jsx-a11y` rules are raised to
error beside them and one, `jsx-a11y/prefer-tag-over-role`, is turned off. The
renderer lints with `--deny-warnings`. Two Vitest rules are deliberately off —
`vitest/valid-expect`, which rejects Vitest's supported
`expect(value, message)` form, and `vitest/require-mock-type-parameters`, which
demands a type argument on every `vi.fn()` — while
`vitest/expect-expect` stays an error with `expect*`, `assert`, and
`assertType` counted as assertions.

**File size — `scripts/renderer/size.mjs`.** 400 lines per source file and 500
per `*.test.ts`/`*.test.tsx` — a suite past that is two suites. Stories are
excluded. An exception needs an allowlist entry with its own ceiling, and the
allowlist only shrinks: a file that comes back under the limit must lose its
entry, and an entry naming a file that no longer exists fails.

**Conventions the linter cannot express — `scripts/renderer/conventions.mjs`.**
Seventeen pattern checks, each naming the rule it keeps and the one place the
pattern is allowed to live, plus two whole-file rules — the module header and
the design-token gate:

- Colors come from tokens; themes use `light-dark()` rather than `dark:`
  classes; motion uses duration tokens.
- A request signal comes from `useRequestSignals` or a caller. `.signal` off an
  inline controller is forbidden everywhere, and building an `AbortController`
  at all is forbidden in `features/*/hooks` and `app/composition` — those
  layers receive a signal, they do not own a request's lifetime.
- A panel takes a typed view model rather than `ReturnType<typeof useX>`; error
  classes extend `FeatureError`; double casts stay at the one approved seam.
- User-facing text comes from the feature's failure-message module. An
  `error.message`, `caught.message`, `reason.message`, or `failure.message` in
  `app/**` or a feature's `ui`, `hooks`, or `application` layer is forwarding a
  developer sentence to a reader; only
  `features/*/application/failure-messages.ts` may read one.
- A feature's `test-support.ts` is imported only from a `*.test.*` file. It
  builds a fixture, not a capability, so product code and stories that reach
  for it are shipping test scaffolding.
- A discarded rejection is annotated. `.catch(() => undefined)` needs a
  `// swallowed:` note on the line or the line above saying why the failure is
  safe to drop.
- Search predicates fold with `toLowerCase`. `toLocaleLowerCase` and
  `toLocaleUpperCase` match differently per machine, so they belong only in a
  file whose name carries `format` or `label` — that is what locale casing is
  for. Oxlint cannot express this: the receiver is any string, not a named
  object, so `no-restricted-properties` has nothing to bind to.
- Tests assert behaviour rather than class names, await conditions rather than
  sleeping, build fixtures from `renderer/src/test`, and query by role, label,
  or the test toolkit. A `querySelector`/`querySelectorAll` outside
  `components/ui` tests needs a `// dom-contract:` note on the line, for the
  cases where a third-party editor's own class or a data attribute the app
  publishes really is the contract under test.
- No file carries a lint or type escape hatch, and a source file over 150 lines
  opens with a module header saying what it owns.
- Every custom property declared in `globals.css` has a reader. The gate
  resolves both spellings the renderer uses: a `var(--name)` anywhere in the
  renderer's own `.ts`, `.tsx`, or `.css` — which is what covers a token read
  by another token and a token read inside an `@utility` block — and, for a
  token declared inside `@theme`, the utility classes Tailwind generates from
  it (`--color-x` → `bg-x`, `text-x`, `border-x`, and the rest of the color
  namespace; `--shadow-x` → `shadow-x`; `--radius-x` → `rounded-x`;
  `--font-x` → `font-x`; `--spacing-x` → the spacing utilities). A token whose
  only reader is CSS this repository does not own is named in the
  `tokenConsumers` allowlist with the stylesheet that reads it; that list is
  empty today and only shrinks, so an entry naming a token that no longer
  exists is itself a failure.

The two annotated rules — `// dom-contract:` and `// swallowed:` — are
line-scoped: the note has to sit where a reader of that line will see it, not
somewhere else in the file.

**Unused code — knip (`renderer/knip.json`).** Unused files, exports, and
dependencies fail. Tests, stories, and the Storybook config are entries, so a
module reachable only from a test counts as used; the reachability check in
`fluid-registry.test.ts` is what proves product callers for primitives. Three
dependencies are in `ignoreDependencies` because knip cannot see the caller:
`@storybook/addon-a11y` and `@storybook/addon-docs` are named as strings in
`.storybook/main.ts`'s `addons` array and loaded by Storybook, never imported;
`shadcn` is the CLI that installs a primitive from `components.json`, run by
hand and never reached from source.

**Duplication — jscpd (`renderer/.jscpd.json`).** Clones of 8 lines or 40
tokens across `src`, threshold 1%, tests and stories excluded.

**Coverage floor — `renderer/vite.config.ts`.** The floor guards the two pure
layers only: `features/*/domain` and `features/*/application` at 85% lines,
functions, and statements and 75% branches. A line in those layers is a
decision, and a unit test is the right proof for it. Every other layer is
measured and reported but carries no floor, because a threshold there
produces tests that restate structure rather than protect behaviour.

Outside the pure layers a test exists for a reason a reviewer can name: a
state machine or discriminated union, a failure ladder, a scope or lifecycle
invariant, a user-visible path such as the J07 chain, or a bug that was fixed.
File length is not a reason. `components` is proven by the story
accessibility runner, the primitive reachability check, and the component
tests that already exist (22 of them, each asserting accessibility); the
installed primitives take no further sibling tests.

**Primitive reachability and story accessibility — `renderer/src/fluid-registry.test.ts`
and `renderer/src/stories.a11y.test.tsx`.** The first proves the
installed Fluid sources stay exclusive, that every catalogued component has a
Storybook canvas, and that every primitive is reachable from product code. The
second composes every story in `renderer/src` — feature stories as well as
primitive ones — under the real provider stack and global CSS, and runs axe
over each at the default, compact, and dark presentations, because CI runs no
Storybook test runner and the `parameters.a11y.test` declaration in
`.storybook/preview.tsx` is inert without one. A story's `play` function runs
before scoring, so opened and expanded states are scored too.

## Implementation Entry Points

- `renderer/renderer-architecture.json` — feature ownership, the registered
  wire-schema modules, and the registered Contract modules.
- `renderer/src/shared/domain/feature-error.ts` — the failure base and kinds.
- `renderer/src/app/dependencies.ts` — where Adapters are selected and Ports
  are bound for the whole application.
- `renderer/src/test` — the shared toolkit: `query.tsx` for a real scoped
  runtime and an isolated QueryClient, `dom.ts` for semantic queries, `axe.ts`
  for element-scoped accessibility assertions, `story-canvas.tsx` for
  composing a story under the real provider stack, `fakes/` for Port fakes,
  and `setup.ts` for the environment every suite shares.

## Validation

From the repository root:

- `pnpm test:renderer-architecture` — the gate's own tests plus
  dependency-cruiser and the layout checker.
- `pnpm check:renderer-size`, `pnpm check:renderer-conventions`,
  `pnpm check:renderer-unused`, `pnpm check:renderer-dupes`.
- `pnpm lint:web`, `pnpm typecheck:web`, `pnpm test:renderer:coverage`,
  `pnpm build:web`, `pnpm build:storybook`.
- `pnpm check:web` runs all of the above through
  `scripts/renderer/check-web.mjs`, and is the single step CI runs as
  **Check supported renderer** in `.github/workflows/ci.yml`. Lint, the
  renderer coverage gate, and the production-equivalent Storybook build are
  inside it, which is why CI has no separate step for any of them; the
  workflow says so above the step, and the runner prints the gate list before
  the first one starts.

`check-web.mjs` opens by naming every gate it is about to run, then runs each
as its own child process **to completion** and only then fails. A serial `&&` chain stops at the first failure and hides every
gate behind it, so one run reports one problem and the next run finds the next;
the runner prints a `pass`/`FAIL` line per gate as it finishes, replays the
output of every gate that failed, names them all in a closing summary, and
exits non-zero if any did. The eleven gates are ordered structure → shape →
behaviour → build: architecture, size, conventions, unused, duplication,
format, lint, coverage, typecheck, build, storybook. Storybook closes the
list because it builds the same sources a second way, in the configuration
the stories are reviewed in.

The four script gates are themselves tested, because a grep-shaped check fails
silently when its pattern stops matching and a runner that stops early looks
exactly like one that passed: `scripts/renderer/architecture.test.mjs`,
`scripts/renderer/check-web.test.mjs`, `scripts/renderer/conventions.test.mjs`,
and `scripts/renderer/size.test.mjs`. The three checkers each build a temporary
tree and assert the exact sentence the gate reports; the runner's tests drive
fake gate commands and assert it reached every one of them.

## Escape Hatches

Each exemption below is named in the gate that grants it, so removing the
reason removes the entry.

- **Milkdown find seam.** `renderer/src/features/documents/ui/markdown/find-controller.ts`
  may use `as unknown as`. Find walks the live DOM the editor renders and
  paints CSS custom highlights; the corpus node and the highlight registry on
  `window` have no shared type with the editor's own. Confining the casts to
  this file is what keeps the rest of the renderer honest.
- **Color literals.** `globals.css` defines the tokens, `lib/focus-ring.ts`
  carries the focus fallback for engines without the token, and
  `shared/brand/logo.tsx` is artwork.
- **`extends Error`.** Only `shared/domain/feature-error.ts`, which is the base
  everything else extends.
- **Class assertions.** `components/ui` tests only, where the class is the
  primitive's contract.
- **Local QueryClients.** `renderer/src/test` only, which is where the shared
  fixture is built.
- **File size.** None. The allowlist in `scripts/renderer/size.mjs` is empty:
  every authored renderer file is under its limit — 400 lines for a source
  file, 500 for a test — and the list only shrinks, so an entry cannot come
  back without a reviewer adding it.
- **Raw error messages.** `features/*/application/failure-messages.ts` only —
  the one module per feature whose job is turning a failure into a sentence.
- **Repository Contracts outside the boundary.** `shared/file-formats` in
  `renderer/src/shared`, and nowhere else. It is a vocabulary the renderer's
  own kernel restates, not a transport shape the boundary maps.
- **A feature entry that is not `public.ts`.** `test-support.ts`, imported
  only from a `*.test.*` file.
- **DOM selectors in tests.** `components/ui` tests, plus any line carrying a
  `// dom-contract:` note.
- **Discarded rejections.** Any `.catch(() => undefined)` whose line, or the
  line above it, carries a `// swallowed:` note.
- **Locale casing.** Files whose name carries `format` or `label`.
- **Design tokens read by third-party CSS.** The `tokenConsumers` allowlist
  in `scripts/renderer/conventions.mjs`, each entry naming the stylesheet that
  reads the token. Empty today: every token in `globals.css` has a reader
  inside `renderer/src`.
- **`jsx-a11y/prefer-tag-over-role` is off.** It rejects an ARIA role wherever
  a semantic element could carry it, which reads `role="status"` on a live
  region and `role="group"` on a PDF page wrapper as markup mistakes. Turning
  it on reports 64 findings, none of them an accessibility defect the story
  axe runner or a primitive test can see.
- **Two Vitest lint rules are off.** `vitest/valid-expect` rejects Vitest's
  supported `expect(value, message)` form, and `vitest/require-mock-type-parameters`
  demands a type argument on every `vi.fn()`. Both are jest-shaped and neither
  protects an invariant this contract names.

## Known Gaps

- The gates run against the replacement only. Journey, visual, accessibility,
  and release evidence stay deferred until the maintainer declares the
  replacement finalized, per
  [the migration staging rules](../AGENTS.md).
- At cutover this contract folds into the permanent `code-review/` set. Until
  then no rule described here is duplicated in a Shipping contract.
