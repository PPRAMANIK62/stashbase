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

For a design discussion or feature audit:
[product direction](../design-docs/overview.md) → corresponding
[area](../design-docs/README.md#product-areas) → affected
[user journey](../design-docs/user-journeys.md) → its row in
[Journey Coverage](journey-coverage.md#traceability-map) → relevant boundary and code.
Pin the checkout being audited. Read only the sections the task crosses.

## Diff-first Review

1. Pin the comparison commit/branch and list changed files. Include uncommitted
   and new files when reviewing the working tree.
2. Read the originating request. Use Journey Coverage to recover intent and
   locate the implementation owners; follow callers for unnamed helpers.
3. Read the affected Engineering Boundaries sections, then trace the diff through
   callers, state changes, failures, and focused tests.
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
evidence. Separate confirmed defects, unproven behavior, and product proposals.
Do not report mechanically enforced style as a product defect.

Product behavior belongs in Design Docs. Local implementation rationale belongs
beside code; lint rules and thresholds belong in executable configuration;
fixtures and assertions belong in tests. Update an existing boundary or journey
instead of adding a document for each module. [MAINTENANCE.md](../MAINTENANCE.md)
owns documentation policy; [AGENTS.md](../AGENTS.md) owns execution gates.
