---
status: accepted
---

# Retire Playwright journey and pixel-baseline evidence

Decision 0007 placed Playwright Electron journeys and reviewed Linux visual
baselines in the replacement test foundation. This decision retires both. The
`e2e` tree, the Playwright configuration and dependencies, the nine
`test:e2e:*` commands, the source-CI smoke and regression jobs, the
visual-baseline workflow, and the UI Regression Testing review contract are
removed. Decision 0007 stands for everything else it records.

## Why

The suites stopped proving the replacement. `e2e` received no change across the
144 commits of the rebuild, and on 2026-09-10 every smoke and harness spec
failed at one shared line in the launch helper, waiting on a legacy onboarding
control that the replacement renderer does not render and that `main` has since
renamed. Their locators, copy, and flows describe a renderer that is being
deleted.

Retargeting them would mean writing assertions against surfaces that tasks 65
through 74 are about to change again, and the migration is not far enough along
to carry a full journey suite. Keeping a red suite in CI teaches the team to
ignore CI.

## What replaces it

A cross-process slice is proven by focused renderer domain, adapter, hook,
component, and composition tests, story accessibility, the Electron boundary
suites, `pnpm test:electron:smoke`, and a driven runtime pass through the built
application recorded in the owning task entry. Journey Coverage renames its
Journey E2E category to Driven Runtime Pass and records, per journey, that no
such pass exists yet.

## What is lost

There is no longer an automated proof that Electron boots, that `app://` serves
under the strict policy, that the preload bridge authorizes, or that a folder
opens end to end. There is no automated catch for a regressed composition.
Both losses are real and are recorded here rather than left implied by a
removed command.

The replacement success criterion that read "the existing release-blocking
Electron and Playwright journeys run against the new production entry" is
replaced by the evidence definition above. Tasks 57 and 58 inherit it.

## Reversal

Nothing in the replacement architecture prevents a journey instrument from
returning. A future decision may adopt one, and it should be chosen against the
replacement's real surfaces rather than restored from the retired specs.
