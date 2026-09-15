# Usage statistics

Official desktop builds share basic usage statistics with PostHog by default.
The collection explanation and controls are in Settings. Turn collection off at any time in
**Settings → General → Privacy → Share basic usage statistics**. Local editing,
Agent access, and every other feature work regardless of this choice.
Development builds and builds without a configured destination do not send.

## What is sent

Each event carries a random installation ID, app version, operating system,
schema version, and event time. The ID is unrelated to your account or hardware;
it can link usage from this installation across launches. It is not a claim of
complete anonymity. No person profiles are created.

| Event | Trigger | Additional fields |
|---|---|---|
| `app_opened` | Workspace shell mounts; once per shared server lifetime across windows | None |
| `project_entry_result` | A project-open operation settles in the host | `outcome` |
| `agent_turn_started` | A non-empty user submission begins context/preparation checks, or a manual retry begins | `runtime` |
| `agent_turn_finished` | Submission is blocked, completes, fails, or is stopped/retired | `runtime`, `outcome`, duration bucket |
| `document_write_result` | Editor versioned save succeeds, fails, or conflicts | `outcome` |
| `agent_setup_result` | Explicit native Agent preparation/login settles, or a known OpenQuill login flow completes/fails | `runtime`, `stage`, `outcome` |
| `telemetry_disabled` | User turns collection off | None |

Runtime values are `stashbase` (OpenQuill), `claude`, and `codex`. Outcomes are
bounded categories (`success`, `failed`, `cancelled`, `blocked`; document saves
use `conflict`). Setup stages are `prepare` and `login`. Durations are under 10
seconds, 10–60 seconds, 1–5 minutes, or over 5 minutes. No exact model names or
request durations are sent. Results describe success/failure/cancellation; raw
error messages never enter the event schema.

Editor saves are limited to one event per outcome per installation per UTC day,
including across restarts. No-change HTTP saves can count; this is evidence of
an editor save operation, not a measure of writing quality or word count. Native
Agent file writes are not inferred from generated replies. Background setup
checks, polling, tool calls, token streaming, and automatic retries do not create
separate usage events. Project entry counts host open results, not native picker
cancellations or import acquisitions that never reach the open operation.

## What is never sent

Documents, prompts, replies, search terms, file names or paths, project names,
repository URLs, account identity, API credentials, hardware fingerprints,
screenshots, clipboard contents, raw errors, logs, or hashes of private content.
There is no automatic click collection, pageview tracking, session replay,
heartbeat, or AI conversation tracing. Outbound payloads request no person
profile, no IP property, and no GeoIP enrichment. The receiving network service
still sees the connection IP; operators must also disable IP retention in PostHog.

## Turning collection off

The app saves the disabled preference locally before attempting one final
`telemetry_disabled` notification with the previous installation ID. Pending
usage requests are cancelled; already transmitted requests cannot be recalled.
The final notification has a two-second timeout, no retry, and no disk queue.
Network failure never prevents disabling collection. A settings-write failure
is shown and stops collection in the current process, but cannot guarantee that
the preference survives relaunch until it is successfully saved.

Disabling removes the local installation ID and daily save markers. Re-enabling
creates a new ID on the next eligible event and never sends historical activity.
This does not delete events already received by PostHog.

A disabled notification means collection was turned off at that moment, not
that the app remains in use. Missing events can also mean offline use, blocked
network access, uninstall, or abandonment. Dashboards must distinguish observed
activity, explicitly disabled reporting, and unknown inactivity. They describe
reporting installations, not all users.

## Implementation and operator setup

[`server/telemetry.ts`](../server/telemetry.ts) owns collection, strict Settings
persistence, suppression, and direct PostHog Capture API requests. The event
allowlist is [`shared/protocols/http/telemetry.ts`](../shared/protocols/http/telemetry.ts).
There is no analytics SDK or durable event queue. Delivery is best-effort with
bounded concurrency and rate limiting; it never blocks writing or shutdown.

[`server/telemetry-destination.json`](../server/telemetry-destination.json) contains
the public PostHog project ingestion token and host for the distributor. This is
not a user credential or Personal API key. Forks should clear or replace it.
Never embed a PostHog Personal API key or project secret key. No end-user setup
or environment credential is required.

Before enabling a production destination, disable IP capture in that PostHog
project and choose a retention period appropriate for basic product statistics.
The application does not alter PostHog administration settings. Suggested initial
views: reporting-installation return activity; project entry to discussion or
editor save; setup/turn/save outcomes. A completed turn is a technical outcome,
not evidence that the response was useful. Missing terminal events remain unknown.

Protocol references: [PostHog Capture API](https://posthog.com/docs/api/capture),
[PostHog collection controls](https://posthog.com/docs/privacy/data-collection).
