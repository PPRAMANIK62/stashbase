# Window Lifecycle

> Review contract for native window identity, renderer durability, shared
> service ownership, and application shutdown.

## Scope and Owners

- Electron main owns `BrowserWindow` identities, native accelerators, close
  orchestration, the single-instance lock, and the child server process.
- The renderer owns the live edit and reports when its save handler is ready.
- The Node server owns per-window folder and Agent bindings plus identity
  retirement.

## State Transitions

```text
created → renderer loaded → save handler ready → close requested
        → save acknowledged → identity retired → native window closed
```

`did-finish-load` is not save readiness. Navigation invalidates the previous
registration. Before readiness there cannot yet be a renderer-owned edit;
after readiness, a save failure or timeout keeps the window open.

## Invariants

- Each window has one stable identity used by HTTP, asset URLs, Agent sockets,
  and server-side folder context.
- Native close awaits the current renderer save barrier before retiring the
  identity. Retirement installs a bounded tombstone so an in-flight open
  request cannot recreate a ghost binding.
- Closing one window releases only that window's folder and Agent state. Shared
  server, daemon, settings, MCP, and other windows remain live.
- Removing a library folder flushes every window showing it, commits membership
  removal, and broadcasts the transition. Recovery may rebind only if durable
  membership still contains the folder.
- A single-flight initial-window operation plus the single-instance lock
  prevents startup races from creating duplicate windows.
- Browser-owned OAuth may return focus only to the live main window whose
  renderer requests it. The focus channel restores, shows, and focuses that
  same sender window; it never accepts an arbitrary identity or creates or
  revives a window. The packaged `stashbase://` handler accepts only the exact
  data-free `oauth-complete` authority. macOS `open-url`, Windows/Linux second
  instances, and cold-start arguments converge on the same bounded focus path;
  all other protocol URLs are inert.
- macOS may remain alive without a window and recreate one on activation.
  Windows and Linux quit after the final window closes. Platform window
  accelerators never masquerade as document-tab commands.
- Frameless chrome remains draggable on every desktop platform; macOS
  traffic-light layout is selected only by the exact Darwin platform marker.

## Shutdown

Electron sends a random per-launch token to the child server, requests loopback
shutdown with that token, and waits for the cleanup ladder. The ladder isolates
MCP listeners, conversions/native children, state storage, and index closure so
one failure cannot skip later owners. OS signals are bounded fallbacks because
Windows signal behavior is not a graceful child shutdown contract.

## Bug-report review windows

The Electron main process solely owns in-memory bug-report drafts. The native
Help menu creates a draft from the source window; the dedicated review window
is bound to that draft through its `webContents`, never a renderer-supplied
draft ID. Its preload accepts only narrow review operations and validates an
opaque artifact reference against the sender-bound draft. References, paths,
destinations, URLs, raw diagnostics, screenshot buffers, and unredacted logs
are never authority or renderer data.

Drafts move from collection to a bound review and then an immutable approved
snapshot. Closing the source drops only an unbound draft; closing, cancelling,
or failing the review retires the bound draft and its references. Collection is
best effort. Text is redacted and independently scanned fail-closed before it
is available, and selected resources are scanned again before an atomic
handoff write. Preparation is local: opening GitHub or saving selected output
requires a separate explicit user action and no private path crosses IPC.

## Failure and Recovery

- Save error or timeout: leave the native window open and surface the failure.
- Late request after retirement: reject it; never recreate window state.
- Initial quit cancelled by an asynchronous window guard: resume quit through
  the platform-specific final-window path.
- Child cleanup timeout: use the bounded fallback and retain diagnostics.
- Second launch during startup: route to the existing application instance.

## Implementation Map

| Role | Stable entry points |
|---|---|
| Native window Module | `electron/multi-window.cjs` |
| Process owner Adapter | `electron/main.cjs` |
| Renderer bridge Adapter | `electron/preload.cjs` and `useActiveFolderWorkspace.ts` |
| Server context Interface | window-scoped registry and retirement in `server/folder.ts` |
| HTTP Adapters | `server/routes/window-context.ts`, `server/routes/internal-shutdown.ts` |
| Cleanup Interface | `server/shutdown-cleanup.ts` |
| Bug-report review owner | `electron/bug-report-service.cjs`, `electron/bug-report-review-window.cjs`, `electron/bug-report-review-ipc.cjs` |
| Focused evidence | `electron/multi-window.test.cjs`, `electron/multi-window-smoke.cjs`, `server/folder-window.test.ts`, `server/window-context-route.test.ts`, `server/internal-shutdown-route.test.ts`, `server/__tests__/shutdown-cleanup.test.ts` |

## Validation

Run:

```bash
pnpm typecheck
pnpm test:electron
pnpm test:electron:smoke
pnpm test:conversion-scheduler
pnpm test:mcp
```

The last two broad server suites own the current window-context, internal
shutdown, and cleanup tests. Cover save readiness, failed save, two independent
windows, folder removal, last-window platform behavior, clean port release,
and a second launch against the same state.

Related journeys: [J01](../design-docs/user-journeys.md#j01-launch-into-a-usable-workspace),
[J02](../design-docs/user-journeys.md#j02-add-and-open-a-folder), and
[J03](../design-docs/user-journeys.md#j03-read-and-edit-source-documents).
