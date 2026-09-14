# Design Docs

StashBase is an **IDE for writing**. The primary journey is **enter a project
→ discuss ideas and brainstorm → write → refine**. The sequence
describes how work develops, not which stages have shipped. These capabilities
are implemented; document-specific diff for fine revision is the remaining
product feature.

This directory owns product intent and observable behavior. Code establishes
what the application currently does, and evidence establishes which claims
have been exercised. The maintenance model lives in
[MAINTENANCE.md](../MAINTENANCE.md).

## Reading Paths

For product orientation, read [Overview](overview.md),
[Principles](principles.md), and [Product Direction](product-direction.md).
[Product Scenarios](product-scenarios.md) explains why people use the product;
[User Journeys](user-journeys.md) describes the observable tasks.

For a design or implementation change:

1. Select the user outcome and narrowest product area below.
2. Read its current behavior, required contract, and known limitations. Consult
   [Glossary](glossary.md) when a term or scope is ambiguous.
3. Follow its owning [review contract](../code-review/README.md) to the
   implementation boundary and focused validation.
4. Use [Journey Coverage](../code-review/journey-coverage.md) to check what the
   evidence actually establishes for the affected outcome.
5. Update the affected records in the same change. A local refactor does not
   require rewriting every layer.

For an existing-code audit, assess necessity against product intent, simplicity
against actual responsibilities and callers, and correctness against contracts
and evidence. For a branch or working-tree change, use the
[diff-first route](../code-review/README.md#diff-first-review) with a fixed
comparison point. A code map helps find files; it does not justify retaining a
feature or establish coverage.

## Primary Journey and Supporting Capabilities

[J01 Onboarding](user-journeys.md#j01-complete-onboarding-and-reach-first-value)
leads into a project and a useful first discussion.
[J10 Core Loop](user-journeys.md#j10-turn-a-local-project-into-durable-agent-assisted-work)
combines project entry, brainstorming, and optional document work. An empty
project is valid; source inspection, search, and wiki building are available
when useful rather than prerequisites.

The other journeys describe implemented capabilities used by that loop.
[J11](user-journeys.md#j11-turn-a-conversation-into-a-project) retains the
secondary unbound-conversation creation contract and its unavailable in-app
entry. [J12](user-journeys.md#j12-build-wiki-pages-from-a-local-folder) and
[J13](user-journeys.md#j13-download-a-ready-made-wiki-from-the-gallery) describe
optional wiki and Gallery workflows. Neither defines the product as a whole.

## Product Areas

| Area | User outcome | Design document |
|---|---|---|
| Workspace | Enter and work within ordinary local projects | [Workspace](design/workspace.md) |
| Documents | Read, draft, edit, save, and inspect local documents | [Documents](design/documents.md) |
| Agent Panel | Brainstorm, draft, and revise with an Agent in project scope | [Agent Panel](design/agent-panel.md) |
| Preparation | Make difficult reference formats usable without replacing them | [Preparation](design/preparation.md) |
| Search and Retrieval | Find relevant project material and return to its source | [Search and Retrieval](design/search.md) |
| Bug Reporting | Prepare and hand off a reviewed local report | [Bug Reporting](design/bug-reporting.md) |

[Architecture](architecture.md) owns product-level data, process, and trust
boundaries. [Visual Style](visual-style.md) owns visual intent; the renderer
styling contract owns implementation mechanics.

## Coarse-to-fine Model

Product identity → user outcome → area contract → implementation → evidence.
Each layer answers a different question; a reviewer follows only the affected
path.

## Document Types

| Record | Owns | Update when |
|---|---|---|
| Overview, Principles, Product Direction | Identity, durable choices, remaining feature direction | A product decision changes |
| Scenarios and User Journeys | Motivation, observable tasks, recovery | A user outcome or flow changes |
| Area design | Capability scope, current experience, required behavior | An area's behavior or boundary changes |
| Glossary | Shared product vocabulary | A term or relationship is settled |
| Engineering contract in `code-review/` | Interfaces, ownership, invariants, implementation entry points | A technical boundary or required guarantee changes |
| Journey Coverage | Traceability and evidence limits | A journey or its evidence changes |

## Status Labels

- **Current / Shipping:** implemented behavior, described within the limits of
  the available implementation and evidence.
- **Experience contract / Required:** behavior that the implementation must
  preserve. A mismatch is a Known Gap, not a reason to pretend it ships.
- **Known Gap:** a defect, implementation limitation, or unproven guarantee in
  an existing capability. It does not mean that the whole feature is missing.
- **Direction:** an approved product direction not yet complete. At present,
  the feature-level item is document-specific diff.
- **Next:** maintenance focus within the area's existing capability, or a link
  to that document-diff direction; not a second feature backlog.
- **Coordinate First / Not Planned:** changes needing a product or boundary
  decision, and work intentionally outside the scope.

Coverage labels such as Partial and Release-dependent belong to the evidence
ledger. They must not be read as a percentage of feature implementation.

## Maintenance Rules

- Keep committed docs concise and English-only. Give every rule one primary
  home and link to it elsewhere.
- Start from the narrowest existing area. A new screen, helper, or file does
  not require a new area, journey, or contract.
- Preserve stable journey IDs and links. When a journey changes, re-evaluate
  its evidence; an old pass does not automatically prove the new flow.
- Keep one qualified format-capability matrix in [Documents](design/documents.md#format-capability-matrix).
  Preview, editing, retrieval, and Agent access are separate claims.
- Product docs contain no source-tree inventory. Review contracts name stable
  implementation entry points; code maps are navigation snapshots; tests own
  exact fixtures and assertions.
- A documentation update does not change UI copy, packaged Agent Instructions,
  permissions, or runtime behavior. Record material mismatches rather than
  silently treating new intent as implemented behavior.
- Use issues and change records for chronology, task ownership, and review
  progress. Run `pnpm test:docs` for changes to these contracts and links.
