# Troubleshooting and Reference

This guide explains the first checks and safe fallbacks for common StashBase
questions. It reflects Shipping behavior as of 2026-09-15.

## Search Returned No Results

Check each stage separately:

1. **Project registration:** Is the expected folder still in the project registry?
2. **Scope:** Is the correct project open?
3. **Mode:** Use **By keyword** for known wording; use **By meaning** for
   related meaning.
4. **Retrieval capability:** Does the format provide direct text, or does it
   need current prepared text?
5. **Preparation:** Is extraction, OCR, or transcription still running,
   blocked, failed, stale, or cancelled?
6. **Search by meaning:** Is a provider configured, and is the expected
   content ready?
7. **Provider availability:** Is the configured key valid, and is the provider
   available within its billing and rate limits?

Switching to keyword search is the normal fallback when searching by meaning
cannot continue. A true empty result, incomplete Preparation, incomplete
indexing, wrong scope, provider failure, and provider billing limits are different
conditions.

## A File Opens but Is Not Searchable Yet

Preview and retrieval are separate capabilities. PDF, DOCX, images, audio, and
video may open before their prepared text is current. Continue browsing, then
retry after Preparation completes. A preparation failure does not make the
source itself a failed file.

A muted generic file is different: it is deliberately outside Search and
automatic Chat context. Strict UTF-8 content can still open read-only; binary,
unsupported encoding, oversized, or unavailable content keeps an explicit
cannot-open surface with a file-manager action. This state does not become
searchable by waiting for Preparation.

For PDF or image preparation, check **Settings → General → Local components**.
The extraction component downloads automatically when first needed. After a
failed download, automatic attempts stop for the app session; the next launch
tries once, or you can select Retry. Browsing still works. The installed
component can process files offline.

For audio or video, download a local model under **Settings → Transcription**.
Check the reported stage when preparation is blocked or fails.

## Searching by Meaning Is Unavailable or Paused

- Add or check the OpenAI or OpenRouter key under **Settings → Search by Meaning**.
- Search uses that provider's billing and availability. StashBase sign-in and
  OpenQuill's free credits do not configure or pay for search.
- Confirm Preparation is complete and the search index is current. Known stale
  evidence is hidden rather than presented as current.
- If the provider fails, use keyword search or read known files directly.
  Removing the key turns meaning-based retrieval off.

Ordinary local file work and discussion without reference lookup remain
available, subject to the selected Agent's own readiness.

## An Optional Wiki Task Failed

A wiki request uses the same Agent setup and permissions as other writing
tasks. It needs no separate search setup. If the Agent wrote a partial page,
inspect that ordinary Markdown file and ask it to continue or revise it.
The default guidance keeps wiki work under `wiki/`. Reorganizing files outside
that directory requires a separate request; wiki instructions are not an
additional filesystem sandbox.

## Agent Panel Chat Does Not Start

Treat these stages separately:

- **OpenQuill unavailable:** sign in to StashBase and check its free credits or
  reported service error. The included runtime needs no separate installation.
- **Runtime missing:** for Claude Code or Codex, choose **Install and continue** only if installation is
  wanted. Opening Chat or a folder never grants that consent.
- **Installation failed:** use **Check again** after installing or repairing
  the runtime outside StashBase; checking does not authorize another download.
- **Agent signed out:** use the selected runtime's sign-in recovery. Codex can
  offer **Sign in with ChatGPT** through that same executable; Claude may
  provide terminal sign-in guidance.
- **MCP connection failed:** use the stage-specific setup or retry action.
- **Turn failed:** use the in-conversation recovery card. The transcript and
  session remain available.

StashBase sign-in and the setup for search by meaning do not sign in Claude
Code or Codex. Resolving setup preserves your draft; send it when ready.

## New Agent Instructions Seem Ignored

A saved customization applies when a new native Chat session mounts. An
already mounted session keeps its original instructions. Start a new Chat to
use the saved guidance. Clearing the customization restores the packaged
project default; StashBase does not rewrite your `AGENTS.md` or `CLAUDE.md`.
Existing customizations are not replaced by an application update.

## A Chat Seems to Be Using the Wrong Folder

Check the conversation's project. An unbound Chat has no project-file access.
A project Chat is pinned to that folder. Opening another project does not
silently rebind a started conversation. Welcome exposes project entry, not an
unbound Chat; enter even an empty project to start discussing an idea.

An out-of-folder search or Agent link opens read-only in the current window.
Open its owning folder in another window for full editing.

## An Agent Cannot Read or Edit a File

Previewability does not imply Agent readability or content editing. Consult
`03 Capabilities and Boundaries.md` for the exact surface:

- external MCP reads current prepared text for PDF, DOCX, audio, and video;
- external MCP does not receive image bytes through `read_file`;
- an Agent Panel runtime may consume an explicitly supplied image;
- preview-only binary formats reject content writes;
- generic Workbench files do not appear in Agent/MCP directory, read, or
  mutation tools;
- rename, move, and delete are separate file-level operations.

For `@` mentions, remember that selecting a result inserts only its
workspace-relative path. It does not attach file bytes or make every format
readable by every Agent client.

## An External MCP Client Cannot See StashBase

- Keep the StashBase desktop app running.
- Confirm the client configuration under **Settings → MCP**.
- Restart clients that read MCP configuration only at startup.
- Confirm the expected folder is a current registered project.
- Confirm requested paths remain inside that member.
- To search by meaning, confirm its setup separately; keyword search remains
  the fallback.

Advanced configuration, URL access, Docker boundaries, CORS, and credential
rotation are documented at
<https://github.com/liliu-z/stashbase/blob/main/docs/mcp-configuration.md>.

## Files Changed Outside StashBase

StashBase reconciles disk changes after server boot, folder entry, focus
return, manual Sync, MCP reindex, Agent turn completion, and relevant settings
changes. Use Sync or `reindex` when an external tool changed files and current
retrieval has not caught up.

An external change that conflicts with an unsaved Markdown, plain-text, or JSON edit is not
silently overwritten. Resolve the visible reload, overwrite, or merge decision.

## Removing a Folder or Start Here

Removing a folder from the project registry clears StashBase-owned derived data, index
rows, ordering, and folder-bound runtime state only after active edits are
saved. It never deletes the source folder or its files from disk.

Deleting a folder on disk is a separate filesystem action. The bundled
`👋 Start Here` folder is created only for a pristine first-use home. If it is
deleted after seeding, StashBase does not recreate it.

The bundled guide is copied as ordinary user-owned content. Later application
updates do not overwrite an existing copy, so dated facts in this folder are a
snapshot rather than a live documentation service.

## Report a Problem

Use **Report Bug** from the sidebar or native Help menu. StashBase prepares a
local draft, lets the user review and independently include or exclude each
available artifact, and never submits anything automatically. The user chooses
whether to open a prefilled GitHub issue or download the files.

Current resources:

- Latest release and notes: <https://github.com/liliu-z/stashbase/releases/latest>
- Source and issue tracker: <https://github.com/liliu-z/stashbase>
- Current online FAQ: <https://stashbase.ai/docs/faq/>
- Current getting-started guide: <https://stashbase.ai/docs/getting-started/>
- Community support: <https://discord.gg/zsRZH4PTq9>
