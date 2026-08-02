# StashBase

StashBase is a local-file workspace that lets people read, write, prepare,
retrieve, and safely share context from their own folders.

## Language

**Active-folder workspace**:
The renderer-owned working context for one currently opened local folder, including its visible files, tabs, document durability, retrieval readiness, and refresh lifecycle. It excludes shell presentation and Agent Panel conversation state.
_Avoid_: global store, app state
