# Design Docs

This directory is the committed source of truth for StashBase product intent.
It explains the outcomes the product protects, the journeys it supports, and
the boundaries contributors should preserve. The code remains the source of
truth for the current implementation.

## Reading Paths

For product orientation:

1. [Overview](overview.md) — what StashBase is and who it serves.
2. [Principles](principles.md) — durable decision rules.
3. [Product Direction](product-direction.md) — intended shape and investment
   themes.
4. [Product Scenarios](product-scenarios.md) — high-level reasons people use
   the product.

For a product change:

1. Find the affected [product area](#product-areas).
2. Check [User Journeys](user-journeys.md) for the observable end-to-end flow.
3. Read [Architecture](architecture.md) when the change crosses ownership,
   lifecycle, or trust boundaries.
4. Read the matching maintainer contract in
   [`code-review/`](../code-review/README.md) before changing code.

For terminology and UI work, use [Glossary](glossary.md) and
[Visual Style](visual-style.md).

## Document Types

| Type            | Purpose                                              | Changes when                                           |
| --------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| Intent          | Overview, principles, and product direction          | Positioning, scope, or a durable decision rule changes |
| Scenario        | High-level user motivation and desired outcome       | The product begins or stops supporting a class of work |
| Journey         | Stable, observable shipping workflow with a `Jxx` ID | A user-visible step, outcome, or recovery path changes |
| Area design     | Current experience and contribution direction        | Shipping behavior or area guidance changes             |
| System contract | Cross-cutting ownership and trust boundaries         | A major runtime or data-flow contract changes          |

Journeys are not test cases. They give automated and manual checks a stable
product vocabulary; the test suite owns exact setup and assertions.

## Capabilities and Product Areas

StashBase has three product capabilities. The **Document Workbench** spans the
Workspace and Documents areas; the **local RAG layer** spans Preparation and
Search and Retrieval; the **Agent Panel** is both a capability and a product
area. Product capabilities describe what StashBase is. Product areas divide
design and contribution ownership.

## Product Areas

| Area                 | User outcome                                                   | Design document                          |
| -------------------- | -------------------------------------------------------------- | ---------------------------------------- |
| Workspace            | Work directly in ordinary local folders                        | [Workspace](design/workspace.md)         |
| Documents            | Read, edit, and navigate supported source files                | [Documents](design/documents.md)         |
| Preparation          | Make difficult formats searchable without replacing the source | [Preparation](design/preparation.md)     |
| Search and Retrieval | Find source evidence for people and Agents                     | [Search and Retrieval](design/search.md) |
| Agent Panel          | Collaborate with Claude or Codex against an explicit scope     | [Agent Panel](design/agent-panel.md)     |

Each area document uses the same shape: user outcome, scope and non-goals,
current experience, experience contract, cross-area seams, contribution
direction, and related journeys/contracts.

## Status Labels

* **Current** — observed shipping experience.

* **Experience contract** — required product behavior. If current code violates
  it, add a plainly named Known Gap and link to the owning review contract.

* **Next** — useful contribution direction, not a release promise.

* **Coordinate first** — valuable cross-cutting work that needs alignment.

* **Not planned** — intentionally outside the current product shape.

Never combine Current and Direction in one bullet. A reader must be able to
tell what the product does now without reconstructing code history.

## Maintenance Rules

* Keep these documents concise and in English.

* Give each topic one home and cross-reference it elsewhere.

* Update affected journeys and area design in the same change as shipping
  behavior. Update intent documents only when the underlying intent changes.

* Keep implementation inventories, state-machine detail, and validation
  matrices in `code-review/`; keep exact assertions in tests.

* Keep coverage ownership in
  [`code-review/journey-coverage.md`](../code-review/journey-coverage.md); a
  journey ID alone does not claim that the flow is automated.

* Use issues and pull requests for schedules, owners, and implementation
  chronology. These documents are not ticket trackers or changelogs.

