# Design Docs

Start with [Overview](overview.md): product identity, typical uses, and principles.
[Product Direction](product-direction.md) describes the remaining document-specific
diff. [Glossary](glossary.md) owns shared terminology.

## Reading Paths

For a feature or design discussion, select its [User Journey](user-journeys.md),
read the owning area below, then use Journey Coverage to find code entry points
and the relevant boundary.
[Journey Coverage](../code-review/journey-coverage.md) records what is proven and
what still needs evidence. For a code diff, start with the
[review guide](../code-review/README.md#diff-first-review).
Read only the affected route.

## Product Areas

| Area | Owns |
|---|---|
| [Writing Workspace](design/writing-workspace.md) | Project entry, Documents/Chat modes, document capabilities, Agent collaboration, and work continuity |
| [Project Context](design/project-context.md) | Preparation, indexing readiness, keyword/meaning-based retrieval, and authorized context |

[Engineering Boundaries](../code-review/architecture.md) owns cross-module rules.
[Visual Style](visual-style.md) owns visual intent; tokens and styling mechanics
remain in their implementation owners.

Documentation ownership, status labels, and maintenance rules live in
[MAINTENANCE.md](../MAINTENANCE.md). Execution and validation gates live in
[AGENTS.md](../AGENTS.md).
