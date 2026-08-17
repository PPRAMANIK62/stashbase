# UI Regression Testing

This contract defines Electron UI test mechanics: layers, fixture boundaries,
selectors, readiness, visual baselines, and the residual release-sanity pass.
The specs remain the source of truth for exact setup and assertions. Product
evidence ownership lives in [Journey Coverage](journey-coverage.md).

## Layer ownership

| Layer | Purpose | Runs |
| --- | --- | --- |
| Focused renderer/unit tests | State machines, parsing, accessibility semantics, and narrow regressions | `source-build` on Linux, macOS, and Windows |
| Electron lifecycle tests | Window, server, save, and shutdown ownership in the real app | `source-build` on Linux, macOS, and Windows |
| Harness contracts | Fixture isolation, launch readiness, diagnostics, normal shutdown, and port release | On demand and when the harness changes |
| Playwright smoke | Launch, primary navigation, note create/edit/reopen, and Settings persistence | Every pull request on Ubuntu |
| Fake Codex protocol contract | Exact stdio JSON-RPC handshake used by the deterministic Agent fixture | Before the Playwright functional project |
| Playwright functional | Longer, regression-prone user journeys, including the credential-free Agent fixture | After smoke on Ubuntu |
| Playwright visual | Redesigned representative surfaces against reviewed Linux images | After smoke on Ubuntu |
| Release sanity | Packaged/native/runtime seams that are expensive or unsafe to fake in required CI | Per release candidate and supported platform |

The Playwright jobs supplement, rather than replace, the existing three-OS
`source-build` matrix. In particular, do not remove either `test:electron` or
the real-app `test:electron:smoke` lifecycle gate when changing the UI suite.

## What a renderer assertion may read

A renderer invariant is asserted against **rendered output**, never against a
component's source text. Mount the component and query what it produced —
`renderToStaticMarkup` for static markup, `react-test-renderer` when the
assertion needs hooks or effects. Assertions live beside the feature that owns
the component, in that feature's `__tests__` folder.

Reading a component file off disk and matching its text pins the invariant to
a file path and a spelling: the assertion breaks when the component moves or
is split, and passes when the component keeps the matched text but stops
rendering it. Both failure modes are wrong in the same direction — the test
tracks the source, not the behavior.

Source text is the correct artefact in exactly two cases, both in
`common/__tests__/renderer-foundation.test.ts`:

- **Stylesheets.** A token forwarding rule such as `--radius-lg:
  var(--radius-container)` has no rendered form to assert against; the text is
  the artefact.
- **Repo-wide literal bans.** The `walkCss` / `walkSources` scans forbid
  specific literals in every file, including inside injected `<style>` strings
  no render reaches. They walk the tree instead of naming paths, so a file
  moving between folders neither breaks them nor drops out of their coverage.

Two Vite-only specifier forms cannot reach Node's resolver, so
`scripts/vite-import-stub-loader.mjs` stands in for both: a colocated
stylesheet import resolves to an empty module, and Vite's `?worker` suffix
resolves to a constructible Worker-shaped stub. It is registered *after* `tsx` in
`test:renderer`, because the most recently registered hook resolves first and
`tsx` would otherwise strip the `?worker` query and load the bare worker
entry, which exports nothing. `domEnvironment` additionally defines the canvas
geometry interfaces (`DOMMatrix`, `DOMPoint`, `Path2D`, `ImageData`) that
pdf.js reads at module scope and happy-dom does not implement.

No renderer component is asserted through source text any more. The PDF
viewer was the last one: its six assertions pinned effect dependency arrays
and the single-scroll-owner protocol, which the 861-line component exposed
nowhere. Splitting it gave each machine a hook with an interface to drive, and
the claims now run against those hooks in
`web-src/src/features/documents/__tests__/pdf-viewer.test.ts`. When an
invariant has no queryable surface, that is the move: give it one, rather than
reading the file that implements it.

## Harness, isolation, and cleanup

Every spec launches the real Electron renderer through `e2e/electron-entry.cjs`
against a disposable fixture created under the system temporary directory.
The fixture owns its own workspace files, config, Electron user data, local
data, folder home, artifacts directory, and loopback port. It redirects
`HOME`, `USERPROFILE`, `LOCALAPPDATA`, `XDG_DATA_HOME`,
`STASHBASE_LOCAL_DATA_ROOT`, `STASHBASE_FOLDER_HOME`, and
`STASHBASE_E2E_USER_DATA`, and pins locale and time zone. Tests must never read
the developer's StashBase config, folders, credentials, CLI history, or normal
application data. Ordinary fixtures also force Agent discovery to the empty
fixture-owned managed-runtime root, so a developer-installed Codex or Claude
cannot create background sessions or error UI. The deterministic Agent journey
alone opts into `system-only` discovery with its fixture executable.

Seed only the data needed by the journey. Mutate the disposable files through
shipping UI or a narrowly scoped native-boundary stub, then assert the
observable UI and persisted file/config state. Native-boundary stubs belong in
journey helpers and must preserve the renderer/main-process contract; they are
not substitutes for the packaged release check.

Launch is ready only after the first window exists and
`body[data-boot-settled="1"]` is set. From there, wait for semantic UI state
with Playwright assertions. Do not use fixed sleeps or `networkidle`: indexing,
editor save, and process shutdown are independent asynchronous boundaries.
The application launcher explicitly skips the AI Index offer for journeys
that do not own onboarding. First-launch coverage opts out of that harness
default, observes the real offer, and makes the choice through shipping UI.
Close through one application-level quit so Electron drives each window's
renderer-save handshake before the server cleanup ladder, then delete only the
fixture's validated scratch root. Do not separately close windows and request
quit: those are competing shutdown initiators and can orphan the server on
Linux. When that asynchronous window guard cancels the initial quit, the final
window restarts quit on Linux/Windows; the harness resumes it after the guarded
window close on macOS, where a windowless session otherwise remains alive.
Harness lifecycle cases explicitly assert port release, including simultaneous
isolated applications.
The launcher records a trace, Electron output, renderer errors, and the server
log when available. Trace bytes are staged in the fixture-owned artifacts
directory before Playwright copies them into its managed test attachments;
the managed output directory is never used as both source and destination. A
failure before the first window may block Electron on a synchronous native
error dialog, so the harness terminates only that fixture's known process tree;
once a window exists, cleanup preserves the normal renderer-save and server
shutdown handshake. Synthetic port blockers must also close their accepted
connections before closing the listener so fixture-owned sockets cannot pin
test teardown.

## Selectors and readiness

Prefer accessible role and name, then stable behavior attributes whose value
is part of the product contract. File-tree rows currently use
`[role="treeitem"]` plus `data-path` to disambiguate duplicate names; active
documents use their tab/tabpanel relationship. A test id is a last resort.
Never select by color, Tailwind utility, DOM index, generated editor structure,
or incidental copy when a semantic control exists.

Keyboard behavior is part of the contract, not test scaffolding. Trees and tab
lists keep roving focus and expose selection/expansion; dialogs return focus to
their trigger; document surfaces expose named regions; progress, errors, and
conversation state use their appropriate live semantics. When an interaction
cannot be selected reliably, improve the shipping semantics and add a focused
accessibility test instead of adding a brittle selector.

## Validation Commands

```bash
pnpm test:e2e:check-focus
pnpm test:e2e:harness
pnpm test:e2e:smoke
pnpm test:e2e:agent-protocol
pnpm test:e2e:functional
pnpm test:e2e:visual
pnpm test:e2e:visual:update
pnpm test:e2e:debug
pnpm typecheck
pnpm build:web
```

On headless Linux, prefix Playwright runs with `xvfb-run -a`. The debug command
is for an interactive local smoke run. `test:e2e:visual:update` is
Linux-authoritative and must not be used on macOS or Windows to approve new
goldens.

## Current automated coverage

Smoke covers an empty-library launch, folder/file/Quick Open/tab navigation,
creating and editing a Markdown note through relaunch, and navigating Settings
while persisting theme and interface size.

The functional project is the set of specs under `e2e/journeys/`. It covers:

- deterministic Codex new-chat discovery, blank-chat reuse, scope freezing,
  history resume, a folder-bound turn, command approval, streamed transcript,
  stop/interruption, and preservation of the same chat while the window
  switches folders;
- dedicated read-only HTML, image, and audio viewers; valid tiny-PDF page
  navigation and page retention across a tab switch; valid DOCX rendering with
  hidden legacy-derived notes; and explicit failure UI that keeps malformed
  PDF and DOCX source identities visible;
- file/folder create, rename, delete cancel/confirm, Favorites persistence,
  library removal without disk deletion, pointer drag reorder/move, visible
  Sync Folder reconciliation of an external mutation, and failed-save barriers
  for document navigation and native window close;
- folder switching and library membership, the titlebar Library switcher,
  launch-time and per-folder AI Index prompting, blank-window skip carryover,
  persistent tabs, Quick Open, Command Palette, and keyboard focus restoration;
- Markdown frontmatter/edit/save, safe local and remote images and links,
  outline disclosure, and Find in both editing and reading modes without
  source mutation;
- source-preserving JSON Tree/Source navigation, keyboard semantics,
  structured scalar editing, raw malformed-source recovery, and saving;
- document Find handoff to active-folder exact search, remembered and
  duplicate-path-aware cross-folder exact search, and the native folder-picker
  success/cancel/error contract through a main-process stub;
- deterministic semantic-search loading, grouped-results, empty, and error UI,
  plus immediate AI Index re-prompting after key removal; and
- keyboard-updated splitter ARIA values plus compact-resize preservation of
  the active document.

`pnpm test:e2e:functional` first runs the standalone fake Codex app-server
contract, then the `electron-functional` Playwright project. The executable
fixture speaks the production stdio JSON-RPC vocabulary through
`STASHBASE_CODEX_BIN` and records only disposable test data. It makes no
network request, reads no credentials, and does not replace the packaged
real-CLI sanity check. The Agent journey also owns browser-level math checks:
streamed and restored replies render through the shared surface, Copy Reply
keeps the original source, and a wide equation scrolls without widening its
panel. Use `pnpm test:e2e:functional --list` for the current
authoritative inventory rather than copying a test count into documentation.

The visual gallery covers the empty-library zero state; the active-folder
workspace shell; Markdown reading; dark Markdown writing; a compact-viewport
document layout; dark valid-JSON reading; light and dark Appearance Settings;
Quick Open; Command Palette; and cross-folder exact search. It intentionally
makes Agent CLI discovery deterministic and unavailable. That visual is a
shell state; the functional Agent journey is a separate deterministic fake
app-server, not a credentialed Agent account. There is no credentialed/network
Agent journey, visual binary-document gallery, preparation workflow,
clipboard-image journey, or real native dialog in this suite.

## Implementation Map

| Role | Stable entry points |
|---|---|
| Playwright configuration | `playwright.config.ts` |
| Application harness Interface | `e2e/support/app.ts`, `fixtures.ts`, `locators.ts` |
| Deterministic fixtures | `e2e/fixtures/journey-workspaces.ts` and the fake Codex app-server |
| Required suites | `e2e/smoke/`, `e2e/journeys/`, and `e2e/visual/` |
| Harness evidence | `e2e/harness/`, `e2e/support/fixtures.test.ts`, and CI summary reporter tests |
| CI Adapter | `.github/workflows/ci.yml` and `.github/workflows/visual-baselines.yml` |

Product-to-test ownership is deliberately outside this mechanics contract; use
[Journey Coverage](journey-coverage.md).

## Visual baseline workflow

Authoritative snapshots are Linux PNGs adjacent to their specs under
`e2e/visual/*-snapshots/`. Ubuntu 24.04 under Xvfb is the only authoritative
rendering environment. The gallery must be bootstrapped through the manual
workflow before its first normal CI comparison can pass; a missing baseline is
a failure, not an implicit approval. Images produced by another Linux host or
container remain provisional until the manual workflow updates and reruns the
gallery for the exact commit; do not treat a local pixel match as CI approval.
Visual fixtures set explicit viewports,
light/dark theme, reduced motion, deterministic content, and unavailable Agent
discovery. They do not broadly mask redesigned content or relax pixel
thresholds. Add a narrow mask only for an unavoidable dynamic value, and
explain it in the spec.

For an intentional visual change:

1. Dispatch **Generate visual baselines** for the exact branch or commit.
2. Confirm its focus check, renderer build, visual inventory, baseline update,
   and unchanged rerun all succeeded.
3. Download `visual-baselines-<run-id>-<attempt>`. Review every PNG and the
   Playwright expected/actual/diff diagnostics, then inspect
   `visual-baselines-status.txt` and `visual-baselines.patch`. The workflow
   summary provides copy-paste `gh run download` and `git apply --binary`
   commands for that exact artifact.
4. A maintainer applies the reviewed binary patch from a checkout of the PR
   head branch, commits only the intended PNG changes, and pushes it. For a
   fork PR, the author must enable **Allow edits from maintainers**; contributors
   do not need to generate or commit Linux baselines. Never approve locally
   generated macOS/Windows images as Linux baselines.
5. Let the normal `ui-regression` job verify the committed baselines.

The manual workflow has read-only repository permission, checks out without
credentials, and never commits or pushes. Its artifact expires after 14 days.
The pull-request job keeps the original visual comparison red, then reruns the
gallery in update mode only to produce a complete candidate Linux patch. This
fallback matters when the manual workflow is itself new and therefore cannot
be dispatched from the default branch yet; candidate generation never approves
or commits a baseline. On failure or cancellation, the job uploads the patch,
candidate gallery, `playwright-report/`, and `test-results/e2e/` for 14 days.
The pre-update comparison is preserved separately so candidate generation
cannot overwrite its expected/actual/diff evidence. Review those diagnostics
and every candidate PNG before applying the binary patch, then let a fresh
normal comparison verify it. Treat artifacts as
diagnostics: do not put secrets or personal documents in fixtures or logs.

## Focus, disabled tests, and flakes

`pnpm test:e2e:check-focus` parses E2E code and rejects focused tests and raw
`.skip`/`.fixme` calls. CI also enables Playwright `forbidOnly`, uses one worker,
retries once, and fails if a test passes only on retry. There is currently no
quarantine helper, so quarantine is not an available state. Fix or revert a
flaky test; do not hide it with a skip, longer sleep, looser assertion, or
global screenshot tolerance. If quarantine becomes necessary, add a reviewed
mechanism with an owner, tracking issue, expiry, and a CI-visible report before
using it.

Add a regression at the lowest layer that proves the behavior. Promote only a
short, release-blocking cross-feature journey to smoke; put broader workflows
in functional specs and representative composition changes in the visual
gallery. Keep the residual packaged/native checks in
[`release-checklists/ui-sanity.md`](../release-checklists/ui-sanity.md) rather
than duplicating automated journeys manually.
