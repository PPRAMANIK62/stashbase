# Product Direction

StashBase is evolving toward three connected capabilities:

> A VS Code-like Document Workbench, a Codex-like Agent Panel, and a local
> RAG layer for document retrieval.

## Document Workbench

StashBase should provide a workbench for browsing, reading, editing, navigating,
and organizing documents across ordinary local folders. Like a code workbench,
it uses a file tree, persistent tabs, quick navigation, and format-appropriate
surfaces, but it remains centered on documents rather than code. It works with
the user's existing files without replacing them with a database, block editor,
or proprietary storage model.

## Agent Panel

The built-in Agent Panel works against an explicit library or folder scope.
Before a document is opened, Chat is the primary working surface; once a
document appears, the same Chat adapts into a side panel alongside the source.
It is a convenient client of StashBase context, not a separate AI workspace
and not a replacement for external Agent clients.

## Local RAG Layer

Opened folders become retrievable context. The local RAG layer prepares
difficult formats, supports exact and meaning-based retrieval, and delivers
source-grounded evidence to Agents. It should explain readiness and failures
clearly without becoming a search or vector-database administration console.

Code repositories give Agents strong lexical structure through paths, symbols,
imports, and stable identifiers, so iterative grep and file reads can often
locate relevant code without a persistent semantic index. Document libraries
are less predictable: a question may not share the wording of its sources, and
evidence may span long-form files, OCR, or transcripts. StashBase therefore
treats preparation, a persistent meaning-based index, and source-grounded
retrieval as one first-class RAG layer instead of relying on exact terms alone.

### AI Index source and activation

AI Index needs a source of embedding capacity, and StashBase strongly steers
every user to set one up at first run — an unindexed library has a degraded
Agent — while stopping short of forcing it. Two sources are intended: a hosted
StashBase account with free monthly usage as the low-friction default for most
people, and a bring-your-own OpenAI/OpenRouter key for advanced users. The
hosted account is not built yet; until it ships, the key path is the only one
that activates.

Recommend, don't lock. Signing in should unlock StashBase's hosted service, not
unlock computation the user's own machine can already do — so browsing, editing,
preview, and keyword search must never be gated behind a remote login. The setup
dialog leads hard toward enabling indexing and has no casual dismiss, but it
offers a deliberate, low-emphasis exit ("Skip AI Index for now") to a
"basic mode". No-index mode is a real, supported state, not a peer presented
with equal weight — so the exit is a plain, low-key link, a per-window "for
now" rather than a permanent opt-out (a fresh window re-offers indexing), and
the surviving local abilities are not advertised as a competing feature; the
default guides everyone to enable.

Activation must not turn local files into something that needs the cloud to
open. The governing rule: first use should choose an indexing source, but daily
use must never depend on online auth to reach local files. Activation persists
locally, while a skip applies only to the current window; the app opens and
serves its existing index offline; a network or service error never forces
re-authentication; and when hosted free usage is exhausted, new AI Index
updates pause while the existing index and Agent retrieval keep working. In
basic mode the Agent still connects but flags, on first use or a failed
retrieval, that indexing is off. Signing out or removing the key returns the
library to the unactivated state.

## Current Investment Themes

The current direction favours contributions that improve:

- Markdown authoring and preview fidelity.
- The clarity and reliability of preparation, indexing, and retrieval.
- The usability and safety of the Agent Panel.
- The Document Workbench's everyday reading and maintenance workflows.
- Cross-platform reliability and an approachable contributor experience.

These themes guide prioritisation; they are not release commitments. Area-level
work and its status live in the [design documents](README.md).
