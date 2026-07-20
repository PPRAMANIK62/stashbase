# Contributing

Thanks for helping improve StashBase. Small focused PRs are easiest to review. For larger changes, please open or comment on an issue first so the scope and design direction can be discussed.

Good places to start:

- [Roadmap and contribution areas](design-docs/roadmap.md)
- [Architecture](design-docs/architecture.md)
- [Markdown rendering](design-docs/markdown-rendering.md)
- [Agent panel design](design-docs/agent-panel.md)

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

## Before Opening a PR

Run the same source checks used by CI:

```bash
pnpm check
```

For Markdown renderer changes:

```bash
pnpm test:renderer
pnpm typecheck
pnpm build:web
```

## Debugging

- Renderer logs: **View -> Toggle Developer Tools**
- Packaged-app server logs: `~/Library/Logs/StashBase/`
- Useful env vars: `STASHBASE_LOG=debug`, `STASHBASE_PYTHON=/path/to/python`, `STASHBASE_BUILD_EXTRACT=1`

API keys are configured in Settings, not environment variables.

## Release Notes for Maintainers

Packaging is release-only. GitHub Actions builds and uploads macOS, Linux, and Windows installers from a release tag.

Release workflow:

1. Commit the code and version bump.
2. Push `main` and wait for `CI` to succeed for the version-bump commit.
3. Create and push the matching `vX.Y.Z` tag, then publish the GitHub Release for that tag.
4. Let the macOS, Linux, and Windows release workflows verify that exact tag commit and attach installers.

Release packaging fails closed when the tag commit has no successful `ci.yml` push run. If CI is still running, the release gate waits for it before packaging starts.

Local macOS fallback:

```bash
pnpm release:verify:mac
pnpm dist:brew
```

Do not commit packaged artifacts. Release outputs belong in `release.nosync/`.
