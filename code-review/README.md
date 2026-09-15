# Code Review

Start from the task, read the relevant boundary, then inspect the code. These
four documents support review; they are not a second implementation manual.

| Document | Read it for |
|---|---|
| This guide | How to scope a review and report useful findings |
| [Engineering Boundaries](architecture.md) | Cross-module ownership, invariants, and focused validation |
| [Journey Coverage](journey-coverage.md) | Journey-to-code entry points, existing evidence, and unresolved gaps |
| [Release Runbook](release-pipeline.md) | CI, packaging, signing, updates, and publication; needed only for release work |

## Intent-first Review

Pin the checkout being audited and choose the affected
[journey](../design-docs/journeys/README.md) or
[capability](../design-docs/README.md#horizontal-designs-capabilities).
Read only the sections the task crosses.

### Vertical Review

Follow a Jxx outcome through its entry, state transitions, failure, cancellation,
and recovery. Use [Journey Coverage](journey-coverage.md#traceability-map) to
locate code and evidence; inspect the shared capabilities crossed by that path.
A working entry does not establish that other entries apply the same rules.

### Horizontal Review

1. Find the capability's [engineering owner](architecture.md#shared-capability-owners)
   and trace actual callers, including non-UI paths when applicable.
2. Compare shared identity, state, permissions, publication, cancellation, and
   recovery rules. Identify which differences are required by the caller.
3. Locate duplicate decisions, bypasses, and competing owners. Propose a common
   owner only where the responsibility is the same; similar-looking code alone
   is insufficient. Record current implementation separately from target design.
4. Test shared behavior at its owner; use entry tests for distinct integration
   risks. Name callers and failure paths that remain unproven.

Use both routes for changes to shared state or behavior used by multiple entries.
Infrastructure can be necessary without a direct user journey.

### Necessity Review

Periodically reverse the route: inventory active UI entries, native commands,
HTTP/MCP surfaces, background owners, and build/release tools, then name the current
user outcome or infrastructure obligation each serves. Existing callers, tests,
and design text alone do not justify a feature; check whether that originating
requirement still exists. Story-only controls are not product features.

Remove retired behavior through every owner: entry, protocol, state, persistence,
provider branches, tests, and documentation. Keep current recovery and external
protocol obligations. Record deliberate feature retirement under the existing
journey ID; do not preserve an inaccessible feature as an indefinite evidence gap.

## Diff-first Review

1. Pin the comparison commit/branch and list changed files. Include uncommitted
   and new files when reviewing the working tree.
2. Read the originating request. Use Journey Coverage to recover intent and
   locate the implementation owners; follow callers for unnamed helpers.
3. Read the affected Engineering Boundaries sections, then trace the diff through
   callers, state changes, failures, and focused tests. Apply horizontal review
   when the diff changes a shared rule or owner.
4. Compare required results with actual evidence. A passing suite proves only
   exercised paths; name missing runtime or real-provider evidence.

For shared infrastructure, start at the ownership/validation table in Engineering
Boundaries. A missing journey alone does not make infrastructure unnecessary.

## Review Output Contract

Answer three questions:

- **Necessity:** which current user task or infrastructure purpose needs this?
  Apply the [previous-version data policy](../MAINTENANCE.md#previous-version-data-policy).
- **Simplicity:** are there duplicate owners, rules, or state; dead branches; or
  obsolete compatibility? Fewer lines alone do not establish a better design.
- **Correctness:** do scope, permissions, concurrency, cancellation, and recovery
  preserve the required behavior?

Each finding needs a code location, violated requirement, consequence, and
evidence. Separate confirmed defects, unproven behavior, product proposals, and
consolidation opportunities.
Do not report mechanically enforced style as a product defect.

Product behavior belongs in Design Docs. Local implementation rationale belongs
beside code; lint rules and thresholds belong in executable configuration;
fixtures and assertions belong in tests. Update an existing boundary or journey
instead of adding a document for each module. [MAINTENANCE.md](../MAINTENANCE.md)
owns documentation policy; [AGENTS.md](../AGENTS.md) owns execution gates.
