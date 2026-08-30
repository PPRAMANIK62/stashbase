# Capability Ledger

This ledger is the migration's progress record. It does not replace
[Journey Coverage](../../../code-review/journey-coverage.md), which remains the
canonical evidence map for Shipping behavior.

Use these statuses only:

- **Not assessed** — current behavior and evidence have not been inspected.
- **Specified** — contracts, required results, and current evidence are pinned.
- **Building** — replacement implementation exists but has not passed its gate.
- **Proven** — mapped evidence passes against the replacement.
- **Cut over** — the production renderer uses the proven replacement.
- **Blocked** — a named decision, Interface, or evidence gap prevents progress.

Passing a broad command alone does not make a row Proven. Add links to the
exact tests or release checks that assert the required result as work begins.

Disposition is **Retain**, **Change**, **Remove**, or **Unresolved**. A capability
may split into sub-rows when its observable behaviors have different
dispositions. `Building`, `Proven`, and `Cut over` rows require every field;
docs validation must reject incomplete rows at those statuses.

| Capability | Journeys | Disposition / decision | Owning contracts | Replacement Interface | Compatibility impact | Status | Exact evidence / blocker / deletion condition |
|---|---|---|---|---|---|---|---|
| Bootstrap and onboarding | J01 | Unresolved / — | Renderer Workspace; Settings and Config; Window Lifecycle | — | — | Not assessed | Populate before Phase 2 |
| Library and folders | J02 | Unresolved / — | Renderer Workspace; File Transactions; Data Lifecycle; Window Lifecycle | — | — | Not assessed | Populate before Phase 2 |
| Documents and editing | J03 | Unresolved / — | Markdown Rendering; Document Viewers; File Transactions; Renderer Workspace | — | — | Not assessed | Populate before Phase 3 |
| Preparation | J04 | Unresolved / — | Data Lifecycle; Document Viewers; File Transactions; Settings and Config | — | — | Not assessed | Populate before Phase 4 |
| Search and source navigation | J05 | Unresolved / — | Data Lifecycle; Renderer Workspace; Settings and Config; MCP Access | — | — | Not assessed | Populate before Phase 3 |
| Agent sessions and Chat | J06 | Unresolved / — | Agent Panel; Agent Runtime; MCP Access; Settings and Config | — | — | Not assessed | Populate before Phase 5 |
| Chat-to-document convergence | J07 | Unresolved / — | Agent Panel; MCP Access; File Transactions; Markdown Rendering | — | — | Not assessed | Populate before Phase 5 |
| External Agent access | J08 | Unresolved / — | MCP Access; File Transactions; Data Lifecycle; Settings and Config | — | — | Not assessed | Populate before Phase 6 |
| Bug-report review | J09 | Unresolved / — | Bug Reporting; Window Lifecycle; Architecture | — | — | Not assessed | Populate before Phase 6 |
| Durable core loop | J10 | Unresolved / — | Renderer Workspace; Data Lifecycle; Agent Runtime; Agent Panel; MCP Access; File Transactions; Markdown Rendering | — | — | Not assessed | Populate before Phase 6 |
| Conversation to project | J11 | Unresolved / — | Renderer Workspace; Settings and Config; MCP Access; Agent Runtime; Agent Panel; File Transactions; Data Lifecycle | — | — | Not assessed | Populate before Phase 6 |

## Cross-Cutting Gates

| Gate | Status | Evidence / decision |
|---|---|---|
| Dependency boundaries | Not assessed | Define enforcement in Phase 1 |
| Runtime contract validation | Not assessed | Define validated protocol inventory in Phase 1 |
| Accessibility and keyboard operation | Not assessed | Map rendered and E2E evidence |
| Theme, scaling, reduced motion | Not assessed | Map visual and functional evidence |
| Initial JavaScript and lazy entries | Not assessed | Record isolated replacement baseline in Phase 0 |
| Startup and interaction performance | Not assessed | Record measurement method in Phase 0 |
| Electron titlebar and window lifecycle | Not assessed | Map smoke and contract evidence |
| Privacy and credential boundary | Not assessed | Map Settings, Agent, MCP, and bug-report evidence |

## Update Rule

Every migration PR updates only the rows it changes. A row moves to Proven
only when its focused evidence runs against the replacement entry. Record an
unresolved requirement as a gap with its owning contract; do not soften the
requirement or describe incomplete behavior as parity.

Any temporary compatibility adapter is named in the final column with its owner
and deletion condition. A changed or removed behavior links its approved
decision; confidence or a broad command is never a substitute for exact
evidence.
