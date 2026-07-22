# Overview

StashBase turns local files into Agent-ready context.

People already keep valuable context in folders: notes, documents, research,
media, and the work produced by earlier agents. These files are difficult for
an agent to reuse reliably: some are not readable as text, and finding the
right material depends too much on filenames, paths, and human memory.

StashBase keeps those files local, prepares the formats that need help, indexes
them, and exposes the resulting context through MCP. The same library can then
serve the app's search, the built-in Agent Panel, and external Agent clients.

## Product Promise

StashBase makes local knowledge usable by agents without asking people to move
that knowledge into a closed cloud workspace or adopt a new file model.

The core loop is simple:

```text
Choose local folders → make files readable → index them → retrieve them in an Agent
```

Agent-written files can enter that same loop, becoming context for later work.

## Who It Is For

StashBase starts with people who already work with local folders and AI agents:
developers, researchers, founders, and knowledge workers who want an agent to
find and use their existing material without repeatedly uploading and
re-explaining it.

## Product Shape

- A local-file workspace for browsing and maintaining ordinary folders.
- Document preparation and retrieval that make those folders useful as context.
- An optional side-panel agent that complements, rather than replaces,
  bring-your-own-agent workflows.

For the durable decision rules, see [Principles](principles.md). For the
intended product shape, see [Product Direction](product-direction.md). For the
system contracts, see [Architecture](architecture.md). For current product
areas and contribution opportunities, start at the [design-docs guide](README.md).
