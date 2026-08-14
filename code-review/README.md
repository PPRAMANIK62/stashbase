# Code Review Contracts

These maintainer-facing contracts make a large codebase reviewable in bounded
context. Start from product intent, follow one change surface to its owning
Interface, inspect the small implementation map, then read the changed code and
focused tests. Code and tests remain the source of truth for current behavior
and exact assertions.

The contract set is an index over deep Modules, not a compressed source-tree
inventory. Select the smallest set of Seams that owns the change; do not load
every contract or expand an Implementation Map unless the change crosses the
named Interface. This is the engineering half of the
[coarse-to-fine documentation route](../design-docs/README.md#coarse-to-fine-route).

## Review Route

```text
product area → user journey → review contract
→ Interface and owner modules → focused tests → changed code
```

1. Read the affected area in
   [`design-docs/design/`](../design-docs/README.md#product-areas).
2. Read the observable flow in
   [`design-docs/user-journeys.md`](../design-docs/user-journeys.md).
3. Choose the focused contract below. Add Architecture only when ownership or
   a process boundary changes.
4. Use its Implementation Map to locate the Interface, primary owners,
   Adapters, and focused validation. Inspect neighboring code only when the
   changed Seam crosses into another contract.
5. Check [Journey Coverage](journey-coverage.md) for end-to-end evidence; do
   not infer coverage from a journey ID alone.

## Choose by Change Surface

| Change surface | Required contract |
|---|---|
| Runtime ownership or cross-process flow | [Architecture](architecture.md) |
| Native windows, save-on-close, app shutdown | [Window Lifecycle](window-lifecycle.md) |
| Bug-report collection, review, approval, handoff, privacy | [Bug Reporting](bug-reporting.md) |
| Renderer folder, tab, search, or overlay coordination | [Renderer Workspace](renderer-workspace.md) |
| Conversion, indexing, reconcile, cleanup | [Data Lifecycle](data-lifecycle.md) |
| Import, save, rename, move, delete, conflicts | [File Transactions](file-transactions.md) |
| PDF, DOCX, HTML, image, audio, or JSON viewers | [Document Viewers](document-viewers.md) |
| Markdown parsing, assets, navigation, trust | [Markdown Rendering](markdown-rendering.md) |
| App config, credentials, onboarding, appearance | [Settings and Config](settings-config.md) |
| MCP tools, transports, credentials, scope | [MCP Access](mcp-access.md) |
| CLI discovery, installation, native sessions, history | [Agent Runtime](agent-runtime.md) |
| Chat renderer, transcript, composer, permissions | [Agent Panel](agent-panel.md) |
| Theme tokens, primitives, CSS boundaries | [Renderer Styling](renderer-styling.md) |
| Journey-to-test ownership and remaining gaps | [Journey Coverage](journey-coverage.md) |
| Electron E2E mechanics, baselines, fixtures | [UI Regression Testing](ui-regression-testing.md) |
| Source CI, packaging, release gating | [Release Pipeline](release-pipeline.md) |

Some changes require more than one contract. An Agent file write, for example,
normally crosses Agent Runtime, MCP Access, File Transactions, and the affected
journey. Read the smallest set that owns the changed Seams.

## Trust Model

Contract language must distinguish these states:

- **Shipping** — evidence-backed current behavior. “Current Experience” in a
  design doc has this meaning.
- **Required** — an invariant new code and reviews must preserve. Unlabelled
  invariant bullets in a review contract have this meaning.
- **Known gap** — current code does not yet meet a Required invariant or a
  journey lacks decisive evidence. Name the implementation location and the
  missing validation; never rewrite the gap as Shipping.
- **Direction** — desired product work that is not committed behavior. Keep it
  under Next or Coordinate First in `design-docs/`, not in a review contract.

When code, tests, and prose disagree, code is the implementation truth, tests
are evidence of exercised behavior, and the docs must be corrected in the same
change. A passing test never makes an uncovered claim true.

## Contract Shape

A focused contract contains only information needed to review its Seam:

- scope, owners, invariants, state transitions, and recovery behavior;
- an **Implementation Map** naming the public Interface, three to eight primary
  owner modules, concrete Adapters, and focused tests or scripts;
- exact validation commands and links to related journeys/contracts;
- any Known gap where Shipping behavior violates the Required contract.

A Module hides related state and decisions. Its Interface includes ordering,
errors, configuration, performance bounds, and invariants—not just function
signatures. An Adapter translates HTTP, MCP, Electron, native-process, iframe,
or renderer events into that Interface. Keep internal Seams private unless an
independent caller or test genuinely needs them.

Do not add file-by-file inventories, test-case prose, exact line references, or
implementation chronology. A path belongs here only when it is a stable review
entry point. Exact fixtures and assertions belong in tests.

## Maintenance Rules

- Keep contracts concise, English-only, and current in the same change as the
  implementation they govern.
- One invariant has one primary home. Other contracts link to it.
- A journey ID describes product coverage; a test path and assertion describe
  implementation coverage. Do not substitute one for the other.
- Add a regression at the lowest useful layer, then promote only
  release-blocking cross-feature behavior into E2E smoke.
- Run `pnpm test:docs` when changing this documentation system.
