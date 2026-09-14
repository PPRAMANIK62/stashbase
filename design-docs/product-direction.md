# Product Direction

StashBase is an **IDE for writing**. Its primary sequence is:

```text
Enter a project → discuss ideas and brainstorm → write → refine
```

This is an order of work, not a delivery roadmap. The existing project,
conversation, document, and context capabilities are implemented. The remaining
product feature is document-specific diff. Defects and evidence gaps are
maintained separately from that feature status.

## AI-native Product Scope

People should be able to start from an idea, a question, or existing material.
An ordinary local folder gives the work a scope. Agent conversation helps them
explore alternatives and develop a direction; documents hold whatever they
choose to write and keep. Moving between discussion and document work should
preserve that continuity.

Reference preparation, indexing, search, MCP, and wiki building support this
workflow. They need no separate mandatory onboarding before a conversation.
Build Wiki is an optional source-organization task, not the product identity or
a required project activation step. Gallery copies are another way to enter
with useful material; existing folders and empty projects remain equal entry
paths.

New work must reuse the local-file, project, permission, and recovery model.
This direction does not introduce proprietary document storage, a global
cross-project search scope, or automatic acceptance of Agent edits.

## Document Workbench

Browsing, creating drafts, reading, editing, saving, resolving conflicts, and
navigating documents already form the writing workspace. The
[Documents capability matrix](design/documents.md#format-capability-matrix)
records which operations each format supports. IDE for writing does not mean
that every previewable format is content-editable.

### Document-specific diff — remaining feature

**Coming soon.** The unfinished feature is an inline, tracked-changes
experience for fine revision. Review happens in the readable document, with
its paragraph structure and formatting retained. Deleted words and phrases
appear in red with strikethrough; additions are highlighted in green at their
place in the prose. The person reads the surrounding sentence and paragraph
instead of switching to a line-oriented source patch.

The intended interaction supports accepting or rejecting individual suggested
changes and accepting or rejecting the full set. These are product-direction
requirements, not claims about the current editor or a live approval gate over
all Agent writes. Existing Agent file diffs and editor/disk conflict comparisons
remain separate implemented mechanisms.

This is a presentation and review model, not a claim that an algorithm can
judge whether a wording change is better. Supported formats, exact change
segmentation, how suggestions remain pending before application, persistence,
and integration with save/version conflicts still need concrete design and
validation. The Documents area owns the experience; Agent Panel and File
Transactions own the integration boundaries. This reference establishes the
inline revision behavior, not a requirement to reproduce another editor's
entire toolbar or layout.

## Agent Panel

Agent collaboration is available for brainstorming, reference questions,
drafting, and revision. The main product entry is a project-bound Chat; it can
start without any source files. Opening a document can dock the same Chat
beside it. A discussion need not produce a file to be useful, and a file is
written only through the requested work and applicable permission rules.

OpenQuill is the included runtime, with account sign-in for its model service.
Claude Code and Codex remain supported alternatives with their own readiness
and authentication. Choosing a runtime is distinct from entering a project.
Source-grounded work can also use authorized external MCP clients.

The backend's unbound-conversation and create-project route remains documented
as a secondary implemented boundary with a currently unreachable in-app entry.
It is not the primary journey or a newly promised no-project Chat feature.
See [Agent Panel](design/agent-panel.md#no-surface-for-an-unbound-chat).

The packaged project Instructions and new Start Here guide copies lead with
brainstorming and requested writing. Current greetings and suggested requests
still include wiki-first language; the remaining mismatch is recorded under
[Agent Panel](design/agent-panel.md#product-language-alignment).

## Local RAG Layer

Preparation and retrieval are implemented context infrastructure for writing
and discussion. They let Agents use text from supported documents, scans, and
recordings and return to the visible source. A source-linked wiki is ordinary
project content and enters the same file and retrieval lifecycle.

An Agent need not search before every brainstorm. Retrieval is useful when a
question or requested change depends on project material. Missing or still
preparing references must not be mistaken for evidence that was actually read.

### Search by meaning is opt-in

Keyword search works independently. A user enables search by meaning by adding
an embedding key under Settings. It is not introduced or offered by onboarding,
project entry, or other surfaces while disabled. Account sign-in serves
OpenQuill; it does not enable search by meaning or provide a search quota.

Adding a key enables background indexing for eligible registered projects;
queries still target one project. Build Wiki is independent of this setting.
Switching a lookup to keyword matching does not pause background indexing;
removing the embedding key disables meaning-based indexing and retains keyword
search. Local file access is not gated on either service.

This document owns the durable opt-in decision. Shipping behavior lives in
[Search and Retrieval](design/search.md),
[J01](user-journeys.md#j01-complete-onboarding-and-reach-first-value), and
[J05](user-journeys.md#j05-search-and-open-source-evidence). Credential and
runtime invariants live in [Settings and Config](../code-review/settings-config.md)
and [Data Lifecycle](../code-review/data-lifecycle.md).

## Current Investment Themes

Complete the document-specific diff experience and maintain the implemented
project, conversation, writing, and reference capabilities. Improvements to
reliability, clarity, performance, and accessibility belong to those existing
capabilities; they are not a second list of unimplemented product features.
