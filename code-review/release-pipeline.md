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

Source validation and platform packaging are separate workflows. A package may
be built only from a tag whose exact commit has a successful `ci.yml` push run.
The reusable gate resolves lightweight or annotated tags, waits for an active
matching run within its bound, and fails closed on missing, failed, cancelled,
or timed-out CI.

## Source CI

- The macOS, Windows, and Linux source matrix covers type/build gates plus
  scheduler, cancellation, renderer, server, MCP, Python, and real Electron
  lifecycle behavior.
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
- Windows provisions the manifest-reading Node runtime and compiler tools inside
  MINGW64. Linux preserves the documented glibc/glibc++ baseline. macOS targets
  12.0 and retains the generic CPU fallback alongside supported acceleration.
- Packaged smoke starts the server, exercises PDF/OCR/DOCX helpers, explicitly
  downloads and verifies the Tiny speech model, transcodes media, runs local
  inference, validates transcript output, and serves the compatible preview
  before upload.

## macOS Unsigned Recovery

The DMG ships `Fix.sh` and user instructions. Replacement retains the previous
application as a same-volume rollback until copy, ad-hoc signing, and strict
verification succeed. Interruption or failure restores the prior bundle; if
restoration itself fails, preserve and report the backup path. Source and
release gates exercise these stages.

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
| Packaging Module | `scripts/package-unsigned.mjs`, `scripts/build-python-sidecar.mjs`, `scripts/build-transcription-sidecar.sh`, `scripts/after-pack-unsigned.cjs` |
| Packaged verification | `scripts/smoke-packaged-server.mjs`, platform release verifiers, and macOS recovery verifier |
| Focused evidence | `scripts/require-green-ci.test.mjs`, `scripts/macos-recovery-installer.test.mjs`, and the platform workflows |

## Release Runbook

When asked to release, run this sequence unattended after the one version
choice:

1. Inspect `git status` and `git log --oneline -10`; group a dirty tree into
   focused commits. Push `main` before tagging.
2. Ask whether the `package.json` version bump is patch, minor, or major.
3. Commit only the bump as `chore: bump to <version>`.
4. Push `main`; wait for the `CI` workflow to succeed for that exact commit.
   Then create and push `v<version>`.
5. Have the maintainer publish the GitHub Release for that tag. Platform
   workflows build assets; they may also be manually dispatched with the tag
   to backfill. macOS tap publication requires `HOMEBREW_TAP_TOKEN` with push
   access to `liliu-z/homebrew-stashbase`.
6. After Actions finish, run `gh release view v<version>`. Verify macOS DMG/zip,
   Linux deb/AppImage, Windows exe/zip, and the tap update, then perform the
   residual packaged UI sanity checks.

Release notes state that macOS is arm64-only and unsigned. Gatekeeper blocks
the first launch; the DMG includes `Fix.sh` and `build/dmg-scripts/Read Me.txt`.

Local macOS fallback only:

```bash
pnpm dist:brew --dry-run
pnpm dist:brew
```

On a fresh machine, install and authenticate `gh`. Never commit a DMG or other
package; `release.nosync/` is the only output root.

Known macOS failures:

- `bundle format is ambiguous (Mantle.framework)` means Electron framework
  symlinks were flattened. Reinstall `node_modules/electron/dist` through the
  Electron installer before retrying.
- `resource fork / Finder information detritus` means iCloud/File Provider
  metadata reached the bundle. Keep both defenses: `.nosync` output and the
  `afterPack` `ditto --noextattr` clone before signing. `xattr -cr` alone is not
  sufficient because File Provider can reapply tags.

## Validation for Pipeline Changes

Run:

```bash
pnpm test:release-gate
pnpm test:macos-recovery-installer
pnpm typecheck
```

Exercise the reusable tag/CI gate against matching, missing, active, failed,
and annotated-tag cases. Any native manifest or packaging change must pass the
platform verifier and `pnpm smoke:packaged-server` before publication.
