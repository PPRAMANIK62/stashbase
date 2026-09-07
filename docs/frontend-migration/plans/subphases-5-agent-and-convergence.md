# Subphase 5 — Agent and Convergence

## Current execution order

After runtime configuration in Task 46, complete the independently unblocked
Agent thread through session lifecycle, composer turns, and permissions in
Tasks 47–49. Then return to Preparation and Retrieval in Tasks 43–45 before
connecting source context, document writes, and durable conclusions in Tasks
50–52. Task 50 remains blocked by Task 45; the earlier Agent work must not
invent source readiness, attachment, or mention behavior ahead of that owner.

## 46 — Configure Agent runtime and credentials

**Blocked by:** 12.

**Status:** Complete.

Delivered ahead of 43-45 — it is blocked only by 12, not by the Preparation/
Retrieval sub-thread, and task 53 depends on the shell this task builds.
Settings is a lazy-loaded `Dialog(presentation="shell")` (a new wide/tall
dialog presentation) with a `SidebarMenuButton` section rail that collapses
into a `MobileDrawer` below a compact-window breakpoint. Only the Agents
section is real; the other five (General, Appearance, AI Index, Transcription,
MCP — task 53's future home) render as inert rows with a "Soon" tag rather
than a heavy opacity fade. The Agents section unifies the old app's two
parallel `runtimeAction`/`runtimeDescription` derivations into one pure
`describeRuntime` function driving a staged discover/install/authenticate/
configure progress track per runtime, plus the 7-day allowance card, a
managed-only Uninstall confirm dialog, and a server-gated (`debug.enabled`)
development-only bootstrap-testing block. The catalog and allowance are
`@tanstack/react-query` queries against the existing `/api/terminal/*` and
`/api/account/agent-usage` server routes (validated at the boundary through a
new `shared/protocols/http/agent-runtime.ts` zod schema), with the catalog
polling every 500ms only while a runtime is actively preparing. A failed
install/login/uninstall/debug mutation stays visible on its row or dialog
instead of silently clearing the busy state. Allowance token detail uses the
managed Base UI disclosure and Button treatment rather than browser-native
`details` chrome. The raised Settings canvas stays at surface 5; its sidebar,
allowance, runtime group, and development block share the one-step-inset
surface 4, while runtime icon wells use surface 3.

Evidence: focused domain, infrastructure, hook, and component tests; shared
protocol schema tests; `pnpm typecheck:web`, `pnpm lint:web` (including the
dependency-cruiser architecture check), and `pnpm test:renderer`.

## 47 — Create and restore Agent sessions

**Blocked by:** 25, 46.

Own scoped session identity, transcript loading, history, folder retirement,
runtime disposal, and bounded reconnect.

## 48 — Run composer turns

**Blocked by:** 47.

Support draft, send, streaming, cancel, retry, and retained-input behavior while
keeping unrelated Workbench interaction responsive.

## 49 — Present permissions and tool calls

**Blocked by:** 13, 48.

Present authorization, pending work, safe arguments/results, and recovery with
complete keyboard and screen-reader operation.

## 50 — Attach source context and mentions

**Blocked by:** 35, 45, 48.

Bind attachments and mentions to explicit source identity/version, expose
Preparation needs, and reject stale context safely.

## 51 — Apply Agent document writes and Diffs

**Blocked by:** 33, 49, 50.

Review and apply Agent changes through versioned file authority with explicit
permission, Diff evidence, save recovery, and conflict handling.

## 52 — Converge Chat conclusions into documents

**Blocked by:** 51.

Complete J07 by writing explicitly accepted conclusions into ordinary durable
source documents rather than treating conversation as source truth.
