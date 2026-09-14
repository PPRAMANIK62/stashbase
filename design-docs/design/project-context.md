# Project Context

## User Outcome

Use local project material during discussion and writing, find relevant evidence,
and return to its original source.

## Scope and Non-goals

Owns format preparation, indexing readiness, keyword/meaning-based retrieval,
and source-grounded context for built-in Agents and external MCP clients.
[Writing Workspace](writing-workspace.md#format-capability-matrix) owns the
format matrix and document experience. One folder is one search namespace;
shared infrastructure does not create a global library.

No user-managed chunks, vectors, converted-file library, or general host-filesystem
access. Visible wiki pages remain ordinary project content.

## Current Experience

### Preparation

Direct-text formats need no durable conversion; eligible PDF/DOCX/images/media
use current extracted/OCR/transcript text. Preparation runs in the background,
prioritizing interactive work. Ordinary previews remain independent. Empty OCR
text is a valid result, not a failed source. Generic visible files are not
implicitly eligible for preparation, search, or Agent access.

First PDF/OCR demand downloads its local component quietly. Failure stops retries
for that process; the next launch tries unfinished installation once, or Settings
can explicitly retry. Installed components work offline, status reads never start
unused downloads, and source bytes are not sent with downloads. Removing or
cancelling a waiting source prevents its later resumption.

Local transcription uses downloaded models. Settings changes apply to future
work; explicit reprocessing uses new preferences. Interrupted work can reuse
valid checkpoints. A playback interruption retains that transcription attempt's
model/language rather than adopting changed Settings.

### Search by meaning is opt-in

Keyword search works without account or provider setup. Search by meaning is
activated only by an OpenAI/OpenRouter embedding key in Settings; disabled
surfaces do not promote it. The provider bills the key owner, independently of
OpenQuill account credits. Adding a key starts eligible registered projects'
background indexing; removing it disables vector indexing and retains keyword
search and prepared-file access.

UI labels are **By keyword / By meaning**. Internally grep matches literal text;
hybrid combines text/vector ranking. Search results use one visible-source shape,
with current readiness and available source locators. Path/type narrowing never
broadens scope. Partial/bounded results must remain identifiable as such.

### Agent and MCP context

An Agent defaults to its bound project; an external client selects one authorized
project. An unbound Chat must bind before reading/searching. Omitted search mode
uses grep without a key and hybrid with one, evaluated on each lookup. Explicit
modes are honored; missing keys/provider failures never cause silent strategy
changes. Keyword lookup does not pause background indexing.

Agent context uses source text or complete, current prepared representations.
Prepared text and index rows are not editable source files. MCP reads and writes
follow the same format, version, and scope rules as other project operations.

## Experience Contract

- Source identity remains authoritative; generated text/checkpoints/indexes stay
  invisible. Preparation never replaces source files or blocks unrelated writing.
- Completion requires current, complete format output, not file existence or a
  progress flag. Stale, partial, cancelled, orphaned, or superseded evidence is
  unavailable. Preparation and vector-index readiness remain separate.
- Explicit cancellation stays stopped; interruption is recoverable through its
  owner. Missing tools or provider failures report actionable state without
  turning local browsing or unrelated sources into failures. Native helpers do
  not steal focus or open console windows.
- Discovery respects exclusions and keeps each project's search scope independent.
- Every result and tool read resolves to an authorized visible source. Empty
  results, invalid caller identity, and failure never widen a namespace.
- Meaning-based retrieval must find relevant sources beyond literal wording;
  representative quality requires evaluation, not a passing adapter test.
- Credentials stay with Settings/provider owners, not renderer state or project
  files. No account path or hosted quota enables search.

## Cross-area Seams

[Writing Workspace](writing-workspace.md) owns project entry, documents, and
conversations. Data Lifecycle owns preparation/index correctness; Settings owns
credentials; MCP Access and File Transactions own authorized reads/writes.

## Contribution Direction

J05 records the missing provider quality baselines.

### Coordinate First

Large first-index cost/latency estimates or controls remain a product decision,
not an approved feature TODO or reason to restore Start/Not now. Changes to
source identity, access, native dependencies, derived ownership, or provider
policy also require their owning decision.

## Related Journeys and Contracts

Journeys: [J01](../user-journeys.md#j01-complete-onboarding-and-reach-first-value),
[J04](../user-journeys.md#j04-prepare-a-hard-to-read-file),
[J05](../user-journeys.md#j05-search-and-open-source-evidence),
[J08](../user-journeys.md#j08-connect-an-external-agent-through-mcp),
[J10](../user-journeys.md#j10-turn-a-local-project-into-durable-agent-assisted-work),
[J12](../user-journeys.md#j12-build-wiki-pages-from-a-local-folder).

Engineering: [boundaries](../../code-review/architecture.md) and
[journey-to-code/evidence map](../../code-review/journey-coverage.md).
