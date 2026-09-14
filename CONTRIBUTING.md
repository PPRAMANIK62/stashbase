# Contributing

Thanks for helping improve StashBase. Small focused PRs are easiest to review. For larger changes, please open or comment on an issue first so the scope and design direction can be discussed.

Start with the [design guide](design-docs/README.md) for product intent and
[review guide](code-review/README.md) for scoped code review. The
[journey map](code-review/journey-coverage.md) leads directly to implementation
owners and evidence.

## Local Development

```bash
git clone https://github.com/liliu-z/stashbase
cd stashbase
pnpm install
pnpm setup:python

# Build the renderer and run Electron
pnpm build:web
pnpm electron

# Development mode
pnpm dev
```

## Testing

During implementation, run the smallest suite that exercises the changed behavior:

```bash
# Renderer feature or one file (paths are relative to renderer/)
pnpm test:renderer src/features/documents
pnpm test:renderer src/features/settings/domain/appearance.test.ts

# One host regression; broader boundary suites are in the journey map
node --import tsx --test server/text-file-transaction.test.ts

# Story interactions and structural accessibility
pnpm test:renderer:a11y
```

`test:renderer` excludes the catalog accessibility sweep and does not build,
check architecture, or collect coverage. `pnpm check:web` is the complete
renderer gate, including coverage, accessibility, static checks, and both builds.
Build and lint commands do only their named work.

Before opening a PR, run `pnpm check` for the complete local source gate.
It includes `check:web`, documentation validation, host suites, type checks,
builds, and Electron smoke; do not repeat its constituent commands afterward.
For a scoped change, follow [AGENTS.md](AGENTS.md) and the affected
[journey](code-review/journey-coverage.md).

The source gate builds each target once. `pnpm test:electron:smoke` builds its
own prerequisites when run alone; `pnpm test:electron:smoke:built` is for a
pipeline that already built the renderer and Electron boundary from the same
checkout. Never use it against stale outputs as evidence for a change.
Headless Linux needs Xvfb; CI supplies it and uses `--no-sandbox` for the isolated
source smoke. Packaged apps and macOS/Windows retain their normal sandbox.

Real-provider evaluations and packaged verification stay in the
[release workflow](code-review/release-pipeline.md); a passing source gate does
not establish model quality or a complete user journey.

## Debugging

- Renderer logs: **View -> Toggle Developer Tools**
- Packaged-app server logs: `~/Library/Logs/StashBase/`
- Useful env vars: `STASHBASE_LOG=debug`, `STASHBASE_PYTHON=/path/to/python`, `STASHBASE_BUILD_EXTRACT=1`

API keys are configured in Settings, not environment variables.

## Release Notes for Maintainers

Follow the [Release Runbook](code-review/release-pipeline.md) for versioning,
source-CI gating, signing, packaging, publication, and residual checks.
Packaging is release-only; outputs stay in `release.nosync/` and are never committed.
