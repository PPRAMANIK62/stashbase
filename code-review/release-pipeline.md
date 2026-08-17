# Release Pipeline

> Review contract for source CI, tag gating, platform packaging, packaged
> native verification, and release handoff.

## Pipeline Shape

```text
source commit → CI push run succeeds
→ matching vX.Y.Z tag
→ GitHub Release or platform backfill workflow
→ macOS / Linux / Windows packages and smoke checks
→ release assets
```

Source validation and platform packaging are separate workflows. Source CI runs
for `main` and `release/**` pushes. A package may be built only from a tag whose
exact commit has a successful `ci.yml` push run.
The reusable gate resolves lightweight or annotated tags, waits for an active
matching run within its bound, and fails closed on missing, failed, cancelled,
or timed-out CI.

## Source CI

- The macOS, Windows, and Linux source matrix covers type/build gates plus
  config/account, scheduler, cancellation, retrieval, renderer, server, MCP,
  Python, and real Electron lifecycle behavior.
- Ubuntu Playwright adds smoke, deterministic functional journeys, and reviewed
  visual baselines without replacing the three-platform source matrix.
- Linux source Electron may use `--no-sandbox` under hosted Xvfb. Packaged apps
  and non-Linux launches must not inherit that flag.

## Native Packaging

- Each platform builds the pinned transcription sidecar for its target. Native
  archives may use declared mirrors only when the accepted bytes match the
  pinned digest.
- Packaging rejects missing/empty binaries, licenses, or notices; wrong binary
  formats; version/build-option drift; unacceptable FFmpeg licensing/features;
  and target ABI or minimum-OS drift.
- Every unbundled local dependency loaded by the Electron main process must be
  included in the electron-builder input. The package-input test scans relative
  CommonJS dependencies that cross out of `electron/` so a source-only smoke
  cannot hide a packaged startup failure.
- Windows provisions the manifest-reading Node runtime and compiler tools inside
  MINGW64. Linux preserves the documented glibc/glibc++ baseline. macOS targets
  12.0 and retains the generic CPU fallback alongside supported acceleration.
- Packaged smoke starts the server, exercises PDF/OCR/DOCX helpers, explicitly
  loads the Electron main-process dependency graph from app.asar, downloads and
  verifies the Tiny speech model, transcodes media, runs local inference,
  validates transcript output, and serves the compatible preview before
  upload.

## macOS Developer ID Distribution

Published macOS apps use a Developer ID Application identity, Hardened Runtime,
secure timestamps, Apple notarization, and a stapled ticket. Release packaging
fails closed when signing or notarization credentials are missing, incomplete,
or ambiguous. The `afterPack` adapter validates versioned framework symlinks
before signing. It preserves the original bundle in clean CI workspaces and
uses a metadata-free clone only for local File Provider workspaces; no package,
Homebrew, or recovery step may mutate or ad-hoc re-sign the app afterward. The
mounted release DMG must pass `codesign`, Gatekeeper `spctl`, and stapler
validation before upload.

## Maintainer Handoff

Version choice, the standalone version-bump commit, tag creation, and GitHub
Release publication remain maintainer-controlled. Do not commit packaged
artifacts; outputs belong under `release.nosync/`.

After workflows finish, verify the release assets and tap update, then run the
residual [Packaged UI Release Sanity](../release-checklists/ui-sanity.md) on
applicable platforms. That checklist covers native, packaged, credentialed,
clipboard, and real-media seams; it does not repeat automated journeys.

## Implementation Map

| Role | Stable entry points |
|---|---|
| Source CI | `.github/workflows/ci.yml` |
| Tag gate Interface | `.github/workflows/release-ci-gate.yml` and `scripts/require-green-ci.mjs` |
| Platform Adapters | `.github/workflows/release-macos.yml`, `release-linux.yml`, `release-windows.yml` |
| Packaging Module | `scripts/package-desktop.mjs`, `scripts/macos-release-contract.mjs`, `scripts/build-python-sidecar.mjs`, `scripts/build-transcription-sidecar.sh`, `scripts/after-pack-macos.cjs` |
| Packaged verification | `scripts/smoke-packaged-server.mjs` and platform release verifiers |
| Focused evidence | `scripts/package-inputs.test.mjs`, `scripts/require-green-ci.test.mjs`, `scripts/macos-release-contract.test.mjs`, and the platform workflows |

## Release Runbook

When asked to release, run this sequence unattended after the one version
choice:

1. Inspect `git status` and `git log --oneline -10`; group a dirty tree into
   focused commits. Push `main`, then create `release/v<version>` from that
   ready commit.
2. Ask whether the `package.json` version bump is patch, minor, or major.
3. Commit only the bump as `chore: bump to <version>`.
4. Push the release branch; wait for the `CI` workflow to succeed for that
   exact commit. Then create and push `v<version>` from the release branch.
5. Have the maintainer publish the GitHub Release for that tag. Platform
   workflows build assets; they may also be manually dispatched with the tag
   to backfill. macOS tap publication requires `HOMEBREW_TAP_TOKEN` with push
   access to `liliu-z/homebrew-stashbase`.
6. After Actions finish, run `gh release view v<version>`. Verify macOS DMG/zip,
   Linux deb/AppImage, Windows exe/zip, and the tap update, then perform the
   residual packaged UI sanity checks.

Release notes state that macOS is arm64-only, Developer ID-signed, and
notarized. The macOS workflow requires the signing certificate secrets
`MAC_CSC_LINK` and `MAC_CSC_KEY_PASSWORD` plus the App Store Connect Team API
key secrets `APPLE_API_KEY_P8`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER`.

Local macOS fallback only:

```bash
pnpm dist:brew --dry-run
pnpm dist:brew
```

On a fresh machine, install and authenticate `gh`. Never commit a DMG or other
package; `release.nosync/` is the only output root.

Known macOS failures:

- `bundle format is ambiguous` means a framework no longer has Apple's required
  versioned-bundle layout. The pre-sign structure check must identify a
  flattened top-level link before `codesign`; reinstall
  `node_modules/electron/dist` through the Electron installer if the source
  framework is already damaged.
- `resource fork / Finder information detritus` means iCloud/File Provider
  metadata reached the bundle. Keep both defenses: `.nosync` output and the
  local-only `afterPack` `ditto --noextattr` clone before signing. CI must retain
  electron-builder's original bundle because it does not have File Provider
  metadata. `xattr -cr` alone is not sufficient in a local File Provider
  workspace because the provider can reapply tags.
- `Unable to find next certificate in the chain` means the Developer ID G2
  intermediate certificate is absent from the signing keychain. Install the
  Apple-published intermediate before exporting or using the identity.
- A rejected notarization must stop publication. Retrieve the notary log,
  repair every unsigned nested Mach-O or invalid entitlement, and rebuild from
  source; never patch an already signed bundle.

## Validation for Pipeline Changes

Run:

```bash
pnpm test:release-gate
pnpm test:package-inputs
pnpm test:macos-signing
pnpm typecheck
```

Exercise the reusable tag/CI gate against matching, missing, active, failed,
and annotated-tag cases. Exercise missing, partial, conflicting, and complete
macOS signing credentials through the focused contract test. Any native
manifest or packaging change must pass the platform verifier and
`pnpm smoke:packaged-server` before publication.
