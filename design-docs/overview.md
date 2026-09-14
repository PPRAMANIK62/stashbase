# Overview

StashBase is an **IDE for writing**. People work in ordinary local projects,
discuss ideas with an Agent, and develop those ideas into documents they own.

## Product Promise

Bring your ideas and, when useful, your own reference material into one place
for discussion, drafting, revision, and review. Local files remain the source
of truth throughout the work.

The primary journey starts with:

```text
Enter a project → discuss ideas and brainstorm → write → refine
```

A project can start empty. Opening a document, searching references, building
a wiki, or finishing background indexing is not a prerequisite for discussion.
People may stay in exploration, return to an earlier conversation, or ask the
Agent to put a result into a file when they are ready. The steps can repeat;
they are not a wizard or a required sequence of screens.

## Current Capability and Remaining Work

Project entry, Agent conversation, local-file handling, preparation, indexing,
retrieval, document editing, and Agent-assisted drafting and revision are
implemented. Users can already inspect files and the Agent's reported changes,
edit the result, and resolve save conflicts.

The remaining product feature is **document-specific diff**, which is not yet
complete. Its direction is to help people understand and review changes to
prose and document structure, beyond the existing file/line comparisons.
That does not make drafting or revision future-only capabilities. Exact scope
and interaction decisions live under [Product Direction](product-direction.md).
Known defects, native-runtime limitations, and evidence gaps remain recorded
in the owning area and review contract; feature availability is not a claim
that every path has been proven.

## Who It Is For

People who develop ideas into writing: researchers, students, writers, and
professionals working on articles, reports, proposals, notes, or other project
documents. They may bring a collection of references or begin with an idea.

## Product Shape

- **Project workspace:** ordinary local folders, files, navigation, and durable
  document editing.
- **Agent collaboration:** brainstorm, ask questions, draft, and revise with
  OpenQuill, Claude Code, or Codex. Chat leads when no document is open and can
  sit beside document work.
- **Reference context:** preparation, indexing, search, and MCP make authorized
  project material usable by people and Agents. A source-linked wiki is one
  supported way to organize that material.

Local browsing, editing, preview, and keyword search do not require an online
account. Agent use follows the selected runtime's setup and authentication;
OpenQuill uses the StashBase account's hosted model service. Optional search
by meaning uses the user's configured embedding provider. Local ownership does
not mean that model requests or configured embedding requests never leave the
machine.

See [Principles](principles.md) for decision rules, [User Journeys](user-journeys.md)
for observable flows, and the [design guide](README.md) for area ownership.
