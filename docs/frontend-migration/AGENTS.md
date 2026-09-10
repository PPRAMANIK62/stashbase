# Frontend migration staging

These instructions apply to tasks in this migration plan and to their
implementation across `renderer`, Electron, preload, shared protocols, and
server adapters. They override the repository's ordinary documentation and
evidence timing while the replacement remains under construction.

## Current stage

Build the replacement to a coherent, reviewable product state before producing
permanent product documentation or end-to-end evidence.

For each migration task:

1. Keep the task status and implementation decisions current under
   `docs/frontend-migration/`.
2. Add focused unit, component, integration, contract, and architecture tests
   when they help establish or protect the implementation.
3. Validate changed code with the relevant format, lint, typecheck, build,
   focused-test, and manual runtime checks.
4. Preserve permanent `design-docs/` and `code-review/` as the Shipping record;
   migration scaffolding does not update them.
5. Defer Electron journey evidence and its CI wiring, visual
   baselines, Journey Coverage, release evidence, and broad UI evidence until
   the maintainer declares the replacement behavior and visual composition
   ready for finalization.

Record incomplete evidence as deferred migration work. Do not claim a
capability Proven or Cut over from implementation checks alone.

## Finalization

When the maintainer explicitly declares behavior and UI finalized, reconcile
the complete replacement with `design-docs/` and `code-review/`, then add the
required journey, accessibility, performance, and release evidence
before cutover.
