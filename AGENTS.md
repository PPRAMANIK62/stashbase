# Agent maintenance contract for this repo

**Before writing code, consult the relevant document in `design-docs/`.**
The docs define product intent, system boundaries, and durable constraints —
for example, local files remain the source of truth, derived artifacts never
surface as user files, and agent access remains folder-bounded. They are not a
source-tree map: use the codebase itself to locate the current implementation.

You are responsible for keeping the relevant docs under `design-docs/` up to
date. Update them as a side effect of relevant code changes — never as a
standalone "documentation pass". If a change touches the surface area one of
these docs covers, edit that doc in the same change.

## The design docs are the source of truth

`design-docs/` is the single, committed home of the design docs — there is
no external mirror to keep in sync. When you change behaviour, update the
affected doc **in the same change** (see the development loop below); reading
and writing them is purely local file work.

Keep them in **English** — these files are committed, so do not introduce
Chinese prose into them.

User-visible **use-case** flows are NOT maintained here. They live in a
separate, manually-run process (`update-use-cases.md`, gitignored) and are
**out of scope for the automatic doc-update loop** — never touch them as a
side effect of a code change.

## The design-document structure

### `design-docs/README.md` — guide and contribution map

Start here. It explains document status labels and points contributors to the
right product area. It is an orientation map, not a ticket tracker.

### `design-docs/overview.md` and `principles.md` — product intent

`overview.md` explains what StashBase is and who it serves. `principles.md`
records stable decision rules. Update them only when product positioning,
scope, or a durable principle changes.

### `design-docs/product-direction.md` — strategic direction

This records the intended product shape and broad investment themes. It is not
a promise list or a substitute for issues.

### `design-docs/architecture.md` — system contracts

This describes runtime shape, ownership, major data flows, access boundaries,
and correctness invariants. Update it when one of those contracts changes. Do
not add a module inventory, file paths, function descriptions, exact line
references, or implementation chronology.

### `design-docs/design/*.md` — product-area design and contribution map

Each area document describes the user outcome, current experience, constraints,
next contributions, and work that needs coordination. Update the affected area
when user-visible behaviour or its contribution guidance changes. Do not
record every implementation detail or use it as a changelog.

The code is the source of truth for implementation details. Tests should carry
precise behavioural and regression coverage; do not duplicate them as a
file-by-file architecture narrative.

## Norms across the docs

- **Source-of-truth precedence**: code > docs. If you change a documented
  behaviour or contract, fix the doc in the same change. Don't write a doc for
  behaviour that is not shipping, except clearly labelled product direction.
- **Concision**: every paragraph should pay rent. Cut whatever doesn't.
- **No duplication across the docs**: each topic lives in one doc and is
  cross-referenced from the others.
- **Language**: English only — these docs are committed. Technical terms and
  identifiers stay as-is.

## README

`README.md` is the external-facing entry. Keep it short; link into the
design docs above.

## Development loop (bug / feature requests)

When the user reports a bug or asks for a feature, run the full loop
without hand-holding:

1. **Locate & diagnose** — consult the relevant design contract, then use code
   reading and tests to find the current implementation. Report root cause when
   the user asked a question; fix directly when they asked for a fix.
2. **Implement**, respecting the documented constraints (context-free
   sync/conversion, hidden derived notes never surface, single-daemon
   ownership, credentials only in Settings — never env).
3. **Verify — never report done without this**:
   - `pnpm typecheck` (always; covers server, MCP, and renderer)
   - `npx vite build --config web-src/vite.config.ts` (renderer changes)
4. **Update the affected design docs in the same change** (local
   `design-docs/` only — there is no external mirror). Update README /
   build map copy when user-visible behaviour changed.
5. Leave the work **uncommitted** — committing happens when the user
   says so (next section).

## Commit protocol

When the user asks to commit (in any language): group the dirty
tree into **focused
commits by theme** — feature / fix / refactor / docs separately, never
unrelated work bundled. Match the existing style: `fix(scope): …`,
`feat(scope): …`, `refactor(scope): …`, `docs(scope): …`, `chore: …`.
Mixed files (one file carrying two themes) may be split by temporarily
restoring + re-applying hunks so each commit compiles on its own.
Do NOT push — push only when the user says push, or as
part of a release.

## Release procedure

**When the user asks to release / package a build (in any language):
prepare everything, then have them publish a GitHub Release for the matching
`v<X.Y.Z>` tag.** Packaging is release-only: GitHub Actions builds and uploads
the macOS, Linux, and Windows installers from the tag. `pnpm dist:brew` remains
the local macOS fallback, but it
is no longer the default release path. The scripts under `scripts/publish-*.mjs`
are implementation details, not the public surface.

Protocol, in order:

1. **Tidy commits first.** Run `git status` + `git log --oneline -10`.
   If the working tree is dirty, group the changes into focused commits
   using the surrounding style (`fix(scope): …`, `feat(scope): …`,
   `chore: …`). Don't bundle unrelated work into one commit. Push is
   part of the release — make sure main is pushed before tagging.
2. **Ask the version bump** (patch / minor / major derived from
   `package.json` `version`). This is the ONE question in the flow;
   everything after runs unattended.
3. **Commit the bump** as a standalone `chore: bump to <new-version>`.
4. **Gate the tag on source CI.** Push `main`, wait for the `CI` workflow to
   succeed for the exact version-bump commit, then create and push the matching
   `v<version>` tag. Every platform release workflow independently verifies
   that the tag commit has a successful `ci.yml` push run; a missing, failed,
   cancelled, or timed-out run blocks packaging.
5. **Hand off**: tell the user to publish the GitHub Release for
   `v<version>` (or manually run the `Release macOS` / `Release Linux` /
   `Release Windows` workflows with that tag to backfill assets). The macOS
   workflow requires `HOMEBREW_TAP_TOKEN` with push access to
   `liliu-z/homebrew-stashbase`.
6. **Verify when Actions finish** (or when asked): `gh release view
   v<version>` — DMG/zip, deb, and Windows exe/zip assets attached, tap commit
   landed.
   Release notes are auto-generated and state: macOS arm64 (Apple Silicon)
   only, unsigned — first launch is blocked by Gatekeeper; run the bundled
   `Fix.sh` (user-facing instructions ship in the DMG as
   `build/dmg-scripts/Read Me.txt`). Report the release URL.

Commands:

```bash
pnpm dist:brew            # local fallback only (add --dry-run to preview)
gh release view v<X.Y.Z>  # verify release assets after Actions finish
```

Prereq on a fresh machine: `brew install gh && gh auth login` (asset
upload uses `gh` when `GITHUB_TOKEN` is unset). Known failure modes:
- codesign "bundle format is ambiguous (Mantle.framework)" = the
  Electron dist's framework symlinks got flattened — fix with
  `rm -rf node_modules/electron/dist && node node_modules/electron/install.js`.
- codesign "resource fork / Finder information detritus" = iCloud
  xattr-tagging (the repo lives under ~/Documents, which syncs).
  Two-layer defence, keep both: output dir is `release.nosync/`
  (.nosync keeps iCloud off the artifacts), and afterPack ditto-clones
  the .app with --noextattr before signing (xattr -cr alone can NOT
  strip fileprovider tags — fileproviderd re-applies them).

Never commit the DMG. `release.nosync/` is gitignored; builds belong there
only. Build internals live in `scripts/package-unsigned.mjs` /
`scripts/build-python-sidecar.mjs` (read the headers, don't guess).
