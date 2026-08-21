# DeepSeek Harness as a Built-in StashBase Agent

Research date: 2026-08-20

Upstream version reviewed: `deepseek-ai/deepseek-harness` at
[`141eb6f`](https://github.com/deepseek-ai/deepseek-harness/commit/141eb6fef83422698aef7a981029e843e8161534)
(`dsh-v0.1.0-rc.8`, 2026-08-19).

## Conclusion

DeepSeek Harness is a credible basis for a third built-in StashBase Agent, but
it is not currently a drop-in peer of Codex and Claude Code. A constrained
proof of concept is highly feasible. Product-grade integration is only
moderately feasible today because the public integration protocols split the
capabilities StashBase needs across two incomplete surfaces, the release is
still a compatibility-breaking developer preview, and the default local
security and credential posture conflicts with StashBase's stricter desktop
contracts. [Upstream README](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/README.md)

The recommended decision is **POC now, no equal-status production launch yet**.
Use an out-of-process sidecar and the SDK JSON-RPC event stream, keep the
runtime read-only and StashBase-scoped, and treat cancellation, approvals,
history management, credential isolation, platform distribution, and upstream
version pinning as explicit gates before shipping.

| Question | Assessment |
|---|---|
| Can StashBase prototype it? | High feasibility |
| Can it use the current Agent Panel? | Yes, through a new native Adapter and event translator |
| Is it a direct third entry in the existing adapter registry? | No; multiple closed two-Agent unions and runtime-specific lifecycle owners must be generalized |
| Can it match the current Codex/Claude interaction contract without upstream or local protocol work? | No |
| Is production integration possible? | Yes, with moderate-to-high engineering and ongoing compatibility cost |
| Is the resulting Agent likely useful? | Yes; model and framework potential are strong, but StashBase-specific task quality is unproven |

## What the framework provides

DeepSeek Harness is a Cordis plugin tree: model adapters, Agent loop, tool
registry, sessions, persistence, sandboxing, permissions, skills, compaction,
subagents, and UI are replaceable plugins assembled by profiles and bundles.
This is a good architectural match for a sidecar because StashBase can supply a
small composition instead of adopting the upstream Web UI. [Architecture](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/docs/architecture.md#cordis)

The default route is `deepseek-official` with `deepseek-v4-flash`, but the
Agent loop is provider-neutral and the official DeepSeek adapter can coexist
with a broader `pi-ai` provider adapter. The direct adapter implements
streaming, reasoning/tool-call passback, usage, retries, timeouts, runtime
model discovery, and dynamic settings. Its defaults currently advertise
V4 Flash and V4 Pro with a one-million-token context window. [Base bundle](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/packages/bundle/base/cordis.patch.yml#L58-L67),
[DeepSeek adapter](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/packages/llm/llm-deepseek/README.md)

The internal Agent lifecycle is complete enough for an interactive product:
each Turn may contain multiple model-and-tool Steps; chunks, final messages,
tool calls/results, status, and errors are durable session events. The session
log is the replay truth. [Turn flow](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/docs/architecture.md#turn-flow)

It can also consume StashBase's existing MCP server as a client and present
the resulting tools under stable `mcp__<server>__<tool>` names. Only MCP Tools
are bridged; MCP Resources and Prompts are not. [MCP client](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/packages/mcp/mcp-client/README.md)

## Fit against the current StashBase Agent contract

StashBase already has the right top-level seam: `AgentAdapter` normalizes
connection, prompts, interruption, transcript events, approvals, history,
models, modes, effort, skills, scope, and lifecycle. The renderer does not need
a third bespoke chat UI. However, the implementation is not yet open-ended:
`AgentId`, `ManagedAgentId`, renderer `AgentKind`, API routes, runtime
discovery, bootstrap, MCP setup, history attribution, and several tests are
closed over `stashbase | claude | codex`. The work is therefore a real fourth
runtime, not a
one-line adapter registration. See [`server/agent-contract.ts`](../server/agent-contract.ts),
[`server/agent-runtime-paths.ts`](../server/agent-runtime-paths.ts),
[`server/agent-runtime-installer.ts`](../server/agent-runtime-installer.ts), and
[`web-src/src/common/lib/agentCatalog.ts`](../web-src/src/common/lib/agentCatalog.ts).

The main protocol choices are:

| Upstream surface | Strength | Blocking gaps for StashBase |
|---|---|---|
| SDK JSON-RPC over stdio | Streams every durable session event and Agent status; supports reusable session IDs and subagent notifications | No Turn/prompt cancel, no per-session close, no prompt-specific result, no model/skill catalog methods, and no server-to-client approval request; abandoning work requires retiring the process |
| ACP over stdio | Standard protocol with cancellation and one-shot permission decisions | Explicitly automation-only; emits committed answers rather than token streaming and omits reasoning, tool activity, plans, titles, history list/load/resume/fork, and interactive configuration |
| Upstream Web host/UI | Complete upstream experience | Creates a second Agent workspace, settings store, transcript UI, and trust boundary inside StashBase; contradicts the Agent Panel product shape |
| In-process Cordis embedding | Direct access to every internal service | Couples Electron to a pre-release plugin graph, Node/runtime constraints, native modules, crash behavior, and package ABI; internal APIs have no compatibility promise |

The SDK JSON-RPC surface is the best starting point because its `session.event`
stream can be translated into StashBase's normalized text, thinking, tool,
tool-result, turn, and error events. Its protocol has only `initialize`,
`session/prompt`, and `shutdown` requests, however, and explicitly has no
protocol-version negotiation or cancellation. [SDK protocol](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/packages/sdk/protocol/README.md),
[SDK server](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/packages/sdk/server/README.md)

ACP solves cancellation and approval but loses the interactive details the
current StashBase transcript promises. It is useful as an automation bridge,
not as the primary panel bridge. [ACP contract](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/packages/acp/acp/README.md)

The clean product path is therefore an SDK sidecar plus either an upstream
protocol extension or a narrow StashBase-owned Cordis bridge that adds:

1. Turn cancellation and per-session disposal.
2. Interactive approval requests and replies.
3. Session list, replay, rename, delete, and stable scope metadata.
4. Model, reasoning-effort, permission-mode, and skill discovery.
5. A negotiated protocol version and bounded compatibility tests.

## Runtime and distribution

An out-of-process sidecar is materially safer than loading the framework into
Electron. The npm workspace requires Node `^22.19.0 || >=24.0.0` and the full
product closure includes native/runtime-sensitive components such as PTY and
platform sandbox helpers. [Root package](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/package.json)

The published Python SDK provides a convenient single-file runtime, but the
current runtime wheels cover Linux x64/arm64 and macOS 14 arm64 only. There is
no Windows or Intel macOS wheel. The current compressed wheels are roughly
52-57 MB each. StashBase would need to limit the POC to macOS arm64, build and
sign missing platforms itself, or package the npm/runtime closure instead.
[Python runtime distribution](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/python/sdk-runtime/README.md)

The release has two additional maintenance risks:

- Upstream is at `0.1.0-rc.8`, openly promises breaking changes, and the rc.8
  release itself reports an incompatible SQLite storage change.
  [Release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.0-rc.8)
- Session persistence rejects unknown/incompatible formats rather than
  providing a general migration promise. Product integration must pin the
  sidecar and its data format together, test upgrade/rollback, and keep an
  export/recovery path.

## Security, privacy, and credentials

The default security posture is not sufficient for an embedded desktop
knowledge product without a narrower composition:

- The filesystem sandbox allows reads in every mode and fences mutations only.
  [Filesystem sandbox](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/packages/fs/fs-sandbox/README.md)
- The shell sandbox confines file effects but explicitly does not restrict
  network or process visibility. Windows ACL and older Landlock enforcement
  may be reported as partial; macOS relies on the deprecated `sandbox-exec`
  mechanism. [Shell sandbox](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/packages/shell/bash-sandbox/README.md),
  [platform provider](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/packages/sandbox/sandbox-local/README.md)
- The upstream managed credential file is owner-only on disk but is readable
  by same-user Agent tools; upstream explicitly describes it as discretion,
  not a boundary. [Credential store](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/packages/credentials/credentials-local/README.md#security-boundary)

Those facts conflict with StashBase's existing contracts: credentials belong
only to the single StashBase app config and Settings, and an Agent must not gain
ambient host filesystem access. See [Settings and Config](../code-review/settings-config.md)
and [MCP Access](../code-review/mcp-access.md).

The POC should therefore mount no raw filesystem or shell tools. It should
expose only the StashBase MCP operations for the selected Library/folder scope,
with read-only policy at first. For a later BYOK product path, keep the real
DeepSeek key in StashBase app config and proxy model requests through a
Node-owned loopback broker authenticated by a random per-process credential.
Do not place the user key in child environment variables, `cordis.yml`, or
DSH's second credential file.

Upstream telemetry should remain disabled. The integration should also review
and, if necessary, strip upstream attribution/session headers before forwarding
requests through any StashBase-owned provider broker.

## Expected quality

The likely quality is **competitive but not yet proven for StashBase**.
DeepSeek's own V4-Pro release table reports strong agent-oriented model results:
for example, V4-Pro scores 87.9 on Terminal-Bench 2.1, 62.7 on DeepSWE, 74.1 on
Toolathlon-Verified, and 71.1 on DSBench-FullStack. In the same vendor-published
table it leads some comparison models on some tasks and trails them on others;
it is not uniformly dominant. V4-Flash is consistently cheaper/faster-oriented
but below V4-Pro in the table. These are model-level, vendor-reported results,
not measurements of the open-source Harness inside StashBase.
[DeepSeek V4-Pro release](https://api-docs.deepseek.com/news/news260813)

The Harness repository publishes no end-to-end coding benchmark results:
`BENCHMARK.md` only explains how to run a benchmark. Consequently, the official
evidence cannot establish parity with the current Codex or Claude integrations.
[Harness benchmark file](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/BENCHMARK.md)

Actual StashBase performance will be the product of four independent factors:

1. DeepSeek V4-Pro or V4-Flash model quality and latency.
2. The selected Harness preset, prompt, compaction, and tool policy.
3. How faithfully the StashBase adapter maps events, approvals, attachments,
   scopes, and MCP results.
4. Whether the restricted tool surface still lets the Agent complete the
   intended document and retrieval journeys.

A production decision needs a blind A/B evaluation on 20-50 real StashBase
tasks, comparing success rate, incorrect file mutations, approval quality,
source-grounding, first-token latency, total latency, token cost, interruption,
and crash recovery against Codex and Claude under equivalent scope and tools.

## Recommended staged plan

### Gate 1: one-week constrained POC

- macOS arm64 only; pin `dsh-v0.1.0-rc.8` and its sidecar artifact.
- Spawn one owned sidecar per live Chat or one process with an explicit session
  ownership policy; do not load Cordis into Electron.
- Translate SDK `session.event` and `session.status` into the common StashBase
  Agent events.
- Support text, streaming transcript, multi-turn session identity, and
  StashBase read-only MCP tools.
- Disable raw shell, raw filesystem tools, upstream telemetry, and DSH-managed
  credentials.
- Treat interrupt as generation retirement/process restart and visibly mark
  the session limitation.

Exit only if startup, first token, streaming, tool traces, resume, crash
recovery, and process cleanup are reliable in packaged Electron.

### Gate 2: protocol and trust hardening

- Add or upstream cancel, approval, session close/history, model/effort, and
  skill methods to the SDK protocol.
- Add a Node-owned DeepSeek credential/provider broker and Settings surface.
- Define process/network isolation and retain StashBase as the only filesystem
  and MCP scope owner.
- Pin protocol/storage compatibility and add upgrade/rollback fixtures.

### Gate 3: productization

- Build, sign, notarize, package, and smoke-test every supported platform.
- Add Agent-specific J06/J10/J11 journey evidence and the focused Agent,
  Settings, MCP, renderer, Electron, and release checks required by the current
  contracts.
- Run the real-task A/B and set explicit launch gates for success rate,
  latency, cost, permission errors, and unsafe scope attempts.
- Keep the Agent behind an experimental flag until those gates pass.

## Licensing and naming

The source is MIT licensed, so use, modification, redistribution, and embedding
are permitted with the copyright and license notice retained. The project also
publishes separate trademark guidance: descriptive phrases such as “built on
DeepSeek Harness” are permitted, while using the full trademark as a product
name or implying official endorsement should be avoided. A UI label such as
“DeepSeek (via DSH)” is safer than naming StashBase's Agent “DeepSeek Harness”,
subject to final legal/brand review. [MIT license](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/LICENSE),
[brand guidelines](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/BRAND_GUIDELINES.md)

## Lower-cost model experiment

If the immediate question is only whether DeepSeek V4 is useful, not whether
DeepSeek Harness should become a new runtime, DeepSeek officially supports the
Responses API used by Codex and documents running Codex against DeepSeek.
That can validate model behavior sooner, but its documented setup rewrites the
shared Codex configuration and stores the API key there, so it is not an
acceptable StashBase product integration under the current Settings and Agent
Runtime contracts. It should be used only as an isolated evaluation, not as the
shipping architecture. [Official Codex integration](https://api-docs.deepseek.com/quick_start/agent_integrations/codex)
