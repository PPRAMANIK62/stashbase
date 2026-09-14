# Preparation

## User Outcome

Project references in hard-to-read formats become usable during discussion
and writing while their original files remain visible and authoritative.
Preparation is implemented supporting infrastructure, not a stage a person
must complete before brainstorming.

## Scope and Non-goals

Preparation covers PDF extraction, image OCR, durable DOCX text derivation,
audio/video transcription, compatible audio preview generation, progress, and
recovery. Together with Search and Retrieval, preparation forms the local RAG
layer. It does not own the
visible source preview, content-editing capability, or semantic ranking. The
[Documents format matrix](documents.md#format-capability-matrix) is the
canonical product-facing boundary between direct-text, prepared-text, and
preview-only behavior.

Users do not manage machine-derived text, checkpoints, model internals, or index
artifacts.

## Current Experience

- Markdown, valid UTF-8 TXT, and JSON use source text directly. HTML supplies an in-memory text
  representation for retrieval. They do not gain visible derived files.
  Generic workspace files have no Preparation or retrieval path; their tree
  visibility does not schedule background work.
- PDF, image, DOCX, audio, and supported video sources may gain AppData-derived
  text. PDF and media derived text also serves Agent reading; source identity
  remains unchanged.
- Preparation runs in the background with interactive and open-folder work
  preferred over project registry background work.
- The first PDF/image preparation automatically downloads its local extraction
  component in the background, without a confirmation dialog. Waiting sources
  continue when installation succeeds; browsing and other preparation work stay
  available. A failed download stops for the current app session and leaves
  sources waiting. The next launch tries the unfinished download once. Settings
  → General → Local components shows its status and failure reason, with an
  explicit Retry action. The installed component works offline. Reading Settings
  never starts an unused download; source bytes are never part of the download.
- Direct DOCX preview and ordinary media playback do not wait for durable
  search preparation.
- Users see preparing, ready, blocked, failed, cancelled, and retryable states
  only when they change the next action. Missing optional capabilities do not
  turn the source itself into a failed file. An image with no recognizable text
  is a normal completed OCR result, not a failure or a reason to Reprocess.
- Transcription Settings identifies the engine, spoken language, and model.
  The local Whisper engine uses downloaded models on the device. Preferences
  apply to future transcription; **Reprocess** applies them again to an
  already prepared file.
- Reprocess is explicit. Large PDF and media work can reuse valid resumable
  checkpoints after transient interruption while manual retry resets the work
  that must be recomputed. A playback fallback temporarily interrupting media
  transcription retains that attempt's model and language, including an explicit
  language override; changing Settings during playback does not retarget it.

## Experience Contract

- Preparation can improve a source but never replace it or make basic browsing
  depend on it.
- Background discovery follows the same project-directory exclusions as the
  local index and shares one folder traversal across prepared formats.
  Dependency caches and generated build trees do not become Preparation work
  merely because the user opens a code-heavy folder.
- A direct-text readable format never becomes dependent on durable Preparation.
  A prepared-text readable format never exposes its derived representation as
  an editable source.
- A derived result is current only when its format-specific completion and
  source-freshness contract succeeds. File existence or an in-memory status is
  not completion truth.
- Conversion completion and readiness for search by meaning remain separate
  states.
- Explicit cancellation remains stopped until the user retries. Transient
  interruption is rediscoverable.
- Optional native tools and state stores degrade to actionable status rather
  than blocking folder entry.
- Cancelling or removing a source while its component is downloading must not
  resume that source later. Other waiting sources can still use the shared download.
- PDF and image OCR helpers must not surface console windows or take focus from
  the user's current work.

## Cross-area Seams

- [Documents](documents.md) owns source preview and editing.
- [Search](search.md) consumes current source or prepared text as evidence.
- [Workspace](workspace.md) keeps background readiness quiet during browsing.
- Data correctness lives in
  [Data Lifecycle](../../code-review/data-lifecycle.md).

## Contribution Direction

### Next

Maintain the implemented capability's reliability, useful status, and recovery
within the existing scope. No additional feature is committed here; the
remaining product feature is [document-specific diff](../product-direction.md#document-specific-diff--remaining-feature).

### Coordinate First

- Derived-data ownership, cleanup, reconcile, retry, or scheduler semantics.
- New native tools or resource-intensive extractors.
- Making visible preview depend on preparation.

### Not Planned

- Asking users to organize generated artifacts.
- Replacing a source with a converted file.
- Treating an artifact's existence alone as proof of readiness.

## Related Journeys and Contracts

Journeys: [J04](../user-journeys.md#j04-prepare-a-hard-to-read-file) and the
[J10](../user-journeys.md#j10-turn-a-local-project-into-durable-agent-assisted-work)
core loop.

Contracts: [Data Lifecycle](../../code-review/data-lifecycle.md),
[Document Viewers](../../code-review/document-viewers.md), and
[Settings and Config](../../code-review/settings-config.md).
