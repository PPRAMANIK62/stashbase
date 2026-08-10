# StashBase

StashBase is a local-file workspace that lets people read, write, prepare,
retrieve, and safely share context from their own folders.

## Language

**Active-folder workspace**:
The renderer-owned working context for one currently opened local folder, including its visible files, tabs, document durability, retrieval readiness, and refresh lifecycle. It excludes shell presentation and Agent Panel conversation state.
_Avoid_: global store, app state

**Canvas**:
A user-visible Markdown document that holds the current shared state of long-running human-Agent work: confirmed decisions, live alternatives, open questions, and the next focus. Conversation may branch, but only conclusions explicitly written back become part of the Canvas.
_Avoid_: transcript, chat summary, whiteboard
