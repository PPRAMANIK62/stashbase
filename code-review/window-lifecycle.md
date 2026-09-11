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
created → renderer loaded → save handler ready → context release requested
        → save acknowledged → close: identity retired → native window closed
                            → reload: identity retained → renderer replaced
                            → update install: every window acknowledged
                              → installer runs → application relaunched
```

A close or reload asks one window and the answer binds that window alone. An
update install asks every live window at once and proceeds only on unanimous
acknowledgement.

A window created for a folder claims that folder once its renderer loads, then
opens it the way a reader's own click would, so the server learns the window's
folder through one path. A reload retains the window identity and the claim is
already spent, so the renderer reads its folder back from the server instead.

`did-finish-load` is not save readiness. Navigation invalidates the previous
registration. Before readiness there cannot yet be a renderer-owned edit;
after readiness, a save failure or timeout keeps the window open.

## Invariants

- Each window has one stable identity used by HTTP, asset URLs, Agent sockets,
  and server-side folder context. Main stamps that identity onto outbound
  renderer requests after checking the sender, its main frame, and its origin,
  so the identity is never renderer-supplied. The system-level statement lives
  in [Architecture](architecture.md#renderer-trust-boundary).
- Every window is created with the shared sandboxed web preferences and loads
  the built bundle from the `app://renderer` application origin. Explicit Vite
  development is the only launch that uses the loopback development origin
  instead. `secureApplicationWindow` enforces whichever origin the launch chose
  and denies navigation off it, popups, `webview` attachment, and permission
  requests. The application origin's own handler attaches the Content Security
  Policy and refuses any request path that escapes the renderer root.
- Capability reaches a window only through the bundled typed preload composed
  from the per-capability modules under `electron/`. A window's capability set
  is recorded at creation, and every IPC handler re-authorizes the sender
  against it before parsing the payload. A window that was created without a
  capability cannot acquire it later.
- Electron provisions the crash-recovery journal key and hands it to the owned
  server. `createRecoveryKeyProvider` in `electron/recovery-key.cjs` generates
  one random 32-byte key per installation under Electron's user-data directory
  and wraps it at rest with `safeStorage`. `createServerChildEnvironment` in
  `electron/main-probe.cjs` passes the unwrapped key in the child server's
  private environment and removes the variable entirely when there is no key,
  so an inherited shell variable can never stand in for operating-system key
  protection. Without that protection the journal stays disabled and no
  plaintext path exists. The storage design and its Known Gap belong to
  [File Transactions](file-transactions.md#crash-recovery-draft-journal).
- Native close awaits the current renderer save barrier before retiring the
  identity. Retirement installs a bounded tombstone so an in-flight open
  request cannot recreate a ghost binding.
- Product-owned reload is error recovery, not ordinary navigation. Native
  Reload and Force Reload menu and keyboard bypasses are absent. Recovery crosses
  main's awaited save barrier; if the failed renderer can no longer answer,
  reload requires a second explicit risk confirmation.
- Closing one window releases only that window's folder and Agent state. Shared
  server, daemon, settings, MCP, and other windows remain live.
- Removing a library folder flushes every window showing it, commits membership
  removal, and broadcasts the transition. Recovery may rebind only if durable
  membership still contains the folder.
- A single-flight initial-window operation plus the single-instance lock
  prevents startup races from creating duplicate windows.
- An Electron-owned source server is always launched with the general
  development-runtime marker, which keeps live Python sources and development
  controls available. The narrower Vite marker is present only when a Vite
  renderer is actually running; a direct source launch and the lifecycle smoke
  serve the built renderer instead of proxying to an absent process. Those
  non-Vite launches use the actual server as Electron's one child so shutdown
  cannot orphan a listener behind a watch wrapper. Source readiness has a
  bounded allowance for cold TypeScript loading; the pre-bundled packaged
  server retains its shorter failure bound. A listener that accepted the TCP
  connection but temporarily missed the health-response deadline receives a
  bounded re-probe before Electron decides whether to reuse or start a server;
  one short timeout can never race a competing child onto the same port.
  Packaged launches explicitly remove both development markers.
- Browser-owned OAuth returns focus only through the packaged `stashbase://`
  handler, which accepts the exact data-free `oauth-complete` authority.
  Renderer polling updates account state without racing that browser-owned
  handoff. Node retains the initiating window identity on the opaque flow, and
  the callback records return intent before opening the fixed deep link so
  Electron can restore that live window rather than whichever window was
  focused most recently. macOS `open-url`, Windows/Linux second instances, and
  cold-start arguments converge on the same bounded focus path; all other
  protocol URLs are inert and a cold invalid launch exits without creating a
  window. Electron authenticates its loopback acknowledgement with a random
  per-launch child-process token so the browser page closes only on evidence
  from the exact native handler.
- macOS may remain alive without a window and recreate one on activation.
  Windows and Linux quit after the final window closes. Platform window
  accelerators never masquerade as document-tab commands: the Window menu is
  built by hand rather than from the stock `windowMenu` role, whose Close item
  would bind Cmd/Ctrl+W, and Close Window stays on Cmd+Shift+W or Alt+F4 so
  the renderer keeps Cmd/Ctrl+W for closing the active document tab.
- Native Help remains main-process-owned and usable when the renderer cannot
  paint. Website, Community Discord, and Report an Issue open fixed shared URLs
  in the system browser; Report a Bug enters the J09 review flow. These are
  cross-cutting support routes, not separate product journeys.
- Electron main owns release checks and installation. The renderer receives a
  bounded state snapshot and may request Check or one Update operation; it
  cannot select a feed or installer path. Update downloads, crosses every ready
  renderer save barrier, invokes the platform installer, and relaunches. A save
  failure leaves the downloaded update ready for retry. Windows uses silent
  NSIS after the explicit click; Authenticode publisher verification applies
  when the installed build was signed. Linux deb may request elevation. The
  AppImage Adapter applies without force-running a competing instance and asks
  Electron to relaunch the final filename after the old process exits. Install
  crosses that barrier with the `update-install` release reason, which is
  distinct from `window-close` and `window-reload` so a release requested for
  an install is never satisfied by an answer the person gave about closing one
  window. Approval is all-or-nothing: every live window whose renderer has
  loaded must acknowledge before any window is pre-approved to close, and a
  single refusal, timeout, or renderer failure cancels the install, grants no
  approval at all, and explains in a native notice why the download is still
  waiting. An install that fails after approval revokes exactly the approvals
  that install granted, so the person's next close is asked again rather than
  passing silently.
- Every application window carries the `updates.desktop` capability in the set
  recorded at its creation, and main publishes each transition of the update
  state machine to every live window that holds it. What a window receives is a
  projection discriminated on the phase, so a version exists only where there
  is an update and a percentage only while bytes are moving, and the
  installer's own diagnostic sentence never crosses the boundary. A window may
  request Check, the one primary Update operation, the release page, and the
  automatic-check preference; it selects no feed, no installer path, and no
  phase. The development-only phase simulator is registered as an IPC handler
  only in an unpackaged build, so a packaged build has no handler for it to
  reach.
- A window created for a folder carries that folder as a one-shot claim. Main
  stores the raw spelling the caller wrote alongside the match key the registry
  lowercases on Windows, answers the renderer with the raw spelling once, and
  forgets it as it answers, so a folder reopened through an equivalent spelling
  never comes back under a rewritten name. The claim is authorized exactly as
  every other library-lifecycle call is, and a window nobody named a folder for
  is answered with no folder rather than a failure. No part of the folder
  travels in the window's URL, so development and packaged windows load the
  same document.
- Frameless chrome remains draggable on every desktop platform; macOS
  traffic-light layout is selected only by the exact Darwin platform marker,
  in the window options and in the renderer alike: the preload stamps the
  platform on the document root and mirrors the window's native fullscreen
  there, which the lifecycle pushes on every change and once the document has
  loaded, and the shell stylesheet keeps the corner under the lights clear
  only for that marker while the lights are showing (see
  [Renderer Styling](renderer-styling.md)).

**Known gap — no driven runtime pass proves an install.** A window can now
request Install, so the all-window save barrier has a caller, but the evidence
for it is still focused over the real lifecycle service, barrier, update state
machine, and renderer boundary. An unpackaged build reports `unsupported`, so a
real download, install, and relaunch remain packaged-release evidence.

## Shutdown

Electron sends a random per-launch token to the child server, requests loopback
shutdown with that token, and waits for the cleanup ladder. The ladder isolates
MCP listeners, conversions/native children, state storage, and index closure so
one failure cannot skip later owners. OS signals are bounded fallbacks because
Windows signal behavior is not a graceful child shutdown contract.

The ladder exists only while Electron lives, so ownership is defended from
both sides. A packaged launch never adopts a compatible listener already on
the port — the single-instance lock makes any such listener an unowned
leftover whose shutdown token died with its parent — and always spawns its own
child. On a failed bind the server SIGKILLs a verified orphaned sibling (same
entry file, parent gone) and rebinds once; live-parented siblings and foreign
listeners are spared and keep the port-in-use guidance. SIGKILL is the reclaim
signal because a sibling wedged in a native call ignores graceful signals and
health probes. An Electron-owned server also watches for POSIX reparenting and
shuts itself down when its owner disappears; both reclaim paths are POSIX-only,
like the daemon reapers.

## Bug-report review windows

The review is an independent dialog-sized window, never a child or modal of its
source, so an open review survives the source closing. It cannot enter full
screen. When created from a full-screen source, it floats in that space instead
of switching macOS to a separate desktop. The window loads the renderer's
dedicated bug-report entry from the same application origin behind its own
narrow review preload. Explicit Vite development instead loads the native
static review page from disk. Closing the review retires its native
identity and tells the owning Bug Reporting Module to discard the bound draft.

Draft authority, preload/IPC scope, privacy, approval, and handoff are owned by
[Bug Reporting](bug-reporting.md); this contract owns only the native window's
creation, presentation, survival, and retirement.

## Failure and Recovery

- Save error or timeout: leave the native window open and surface the failure.
- Reload save error or timeout: keep the current renderer and buffer; never
  turn the error-recovery button into a force reload.
- Update install refused by any window: cancel the install, keep the phase at
  ready, grant no close approval, and name the reason in a native notice.
- Update install failure after every window approved: revoke exactly those
  approvals so the next native close crosses the barrier again.
- Late request after retirement: reject it; never recreate window state.
- Initial quit cancelled by an asynchronous window guard: resume quit through
  the platform-specific final-window path.
- Child cleanup timeout: use the bounded fallback and retain diagnostics.
- Server startup failure: record the cause before opening the native error
  dialog so unattended launches retain actionable process output.
- Temporarily unresponsive listener during startup: re-probe for a bounded
  interval. Reuse it if compatibility becomes visible, start only after the
  port becomes free, and retain port-in-use guidance if it stays occupied.
- Second launch during startup: route to the existing application instance.
- Orphaned sibling server on the port: reclaim and rebind once; a
  live-parented or foreign holder keeps the port-in-use guidance.
- Owner dies without running the ladder: the reparented server shuts itself
  down and the next launch reclaims anything left.

## Implementation Map

| Role | Stable entry points |
|---|---|
| Native window Module | `electron/multi-window.cjs` |
| Renderer durability Interface | `registerWindowLifecycle` in `electron/window/lifecycle.ts`, which owns the loaded, pre-approved-close, and pending-request state and exposes `hasLoadedRenderer`, `requestContextRelease`, `approveClose`, and `revokeCloseApproval` as the only access to it |
| Process owner Adapter | `electron/main.cjs`; child-environment construction and bounded stable-port probing in `electron/main-probe.cjs` |
| Window origin and policy | `electron/app-protocol.cjs` for the application origin, Content Security Policy, and renderer-root containment; shared web preferences and navigation/permission denial in `electron/window-security.cjs` |
| Renderer bridge Adapter | the per-capability preload modules under `electron/library/`, `electron/window/`, `electron/workspace/`, `electron/capture/`, `electron/external-navigation/`, `electron/bug-report/`, and `electron/renderer/`, composed into one bundled preload and read on the renderer side by `renderer/src/platform/electron/bridge.ts` |
| IPC authorization Interface | `authorizeSender` in `electron/library/dialog.ts`, over the wire schemas in `shared/protocols/electron/`; outbound request authorization in `electron/renderer/requests.cjs` |
| Recovery key provider | `createRecoveryKeyProvider` in `electron/recovery-key.cjs`, delivered to the child server by `electron/main-probe.cjs` |
| Server context Interface | window-scoped registry and retirement in `server/folder.ts` |
| HTTP Adapters | `server/routes/window-context.ts`, `server/routes/internal-shutdown.ts` |
| Cleanup Interface | `server/shutdown-cleanup.ts`; orphan reclaim in `server/stale-lock.ts`; parent watchdog in `server/parent-watchdog.ts` |
| Bug-report window Adapter | `electron/bug-report-review-window.cjs`; draft authority lives in [Bug Reporting](bug-reporting.md) |
| Desktop update Module | `electron/update-manager.cjs`; platform install strategy in `electron/update-install-strategy.cjs`; all-window save barrier in `electron/update-window-barrier.cjs`, composed over the window lifecycle service by `createWindowLifecycleUpdateBarrier`, which resolves that service per call because main installs the replacement boundary after the update manager exists; renderer boundary in `electron/updates/ipc.ts` and `electron/updates/preload.ts` over the wire contract in `shared/protocols/electron/updates.ts`; native wiring in `electron/main.cjs` |
| Focused evidence | `electron/multi-window.test.cjs`, `electron/app-protocol.test.cjs`, `electron/window-security.test.cjs`, `electron/recovery-key.test.cjs`, `electron/update-manager.test.cjs`, `electron/update-install-strategy.test.cjs`, `electron/update-window-barrier.test.cjs`, `electron/updates/ipc.test.cjs`, `electron/updates/preload.test.cjs`, `shared/protocols/electron/updates.test.ts`, `electron/window/lifecycle.test.cjs`, `electron/window/preload.test.cjs`, `electron/multi-window-smoke.cjs`, `server/folder-window.test.ts`, `server/window-context-route.test.ts`, `server/internal-shutdown-route.test.ts`, `server/stale-lock.test.ts`, `server/parent-watchdog.test.ts`, `server/__tests__/shutdown-cleanup.test.ts` |

## Validation

Run:

```bash
pnpm typecheck
pnpm test:electron
pnpm test:electron:smoke
pnpm test:updates
pnpm test:conversion-scheduler
pnpm test:mcp
```

The last two broad server suites own the current window-context, internal
shutdown, and cleanup tests. Cover save readiness, failed save, two independent
windows, folder removal, last-window platform behavior, clean port release, a
second launch against the same state, a refused update install across two
windows, and an install failure that must return those windows to asking. A change to the application origin,
the preload surface, or an IPC guard also covers an escaping asset path, an
unauthorized sender or frame, a window without the capability, and a launch
with no operating-system key protection.

Related journeys: [J01](../design-docs/user-journeys.md#j01-complete-onboarding-and-reach-first-value),
[J02](../design-docs/user-journeys.md#j02-add-and-open-a-folder), and
[J03](../design-docs/user-journeys.md#j03-read-and-edit-source-documents), plus
[J09](../design-docs/user-journeys.md#j09-prepare-and-hand-off-a-bug-report) for
the dedicated review window.
