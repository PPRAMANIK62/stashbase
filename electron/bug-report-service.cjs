'use strict';

const crypto = require('node:crypto');
const { scanBugReportText } = require('./bug-report-redaction.cjs');

const DRAFT_STATE = Object.freeze({
  DRAFT: 'draft',
  REVIEWING: 'reviewing',
});

const ERROR = Object.freeze({
  INVALID_DRAFT: Object.freeze({
    code: 'INVALID_DRAFT',
    message: 'The bug report draft reference is invalid.',
  }),
  NOT_FOUND: Object.freeze({
    code: 'NOT_FOUND',
    message: 'The bug report draft is no longer available.',
  }),
  FORBIDDEN: Object.freeze({
    code: 'FORBIDDEN',
    message: 'This window cannot access that bug report draft.',
  }),
  INVALID_OWNER: Object.freeze({
    code: 'INVALID_OWNER',
    message: 'The bug report draft could not be associated with this window.',
  }),
  REVIEW_ALREADY_BOUND: Object.freeze({
    code: 'REVIEW_ALREADY_BOUND',
    message: 'The bug report draft is already being reviewed.',
  }),
  UNAVAILABLE: Object.freeze({
    code: 'UNAVAILABLE',
    message: 'The bug report service is temporarily unavailable.',
  }),
});

function copyError(error) {
  return { code: error.code, message: error.message };
}

function fail(error) {
  return { ok: false, error: copyError(error) };
}

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function createId() {
  return crypto.randomBytes(32).toString('base64url');
}

function toIso(now) {
  return new Date(now()).toISOString();
}

function safeDiagnostics(value) {
  if (!value || typeof value !== 'object' || !value.app || !value.os) return null;
  const { app, os } = value;
  if (
    !Number.isSafeInteger(value.schemaVersion)
    || typeof value.capturedAt !== 'string'
    || typeof app.name !== 'string'
    || typeof app.version !== 'string'
    || typeof app.packaged !== 'boolean'
    || typeof app.electronVersion !== 'string'
    || typeof os.platform !== 'string'
    || typeof os.release !== 'string'
    || typeof os.arch !== 'string'
  ) {
    return null;
  }
  return Object.freeze({
    schemaVersion: value.schemaVersion,
    capturedAt: value.capturedAt,
    app: Object.freeze({
      name: app.name,
      version: app.version,
      packaged: app.packaged,
      electronVersion: app.electronVersion,
    }),
    os: Object.freeze({
      platform: os.platform,
      release: os.release,
      arch: os.arch,
    }),
  });
}

function copyDiagnostics(value) {
  return value === null ? null : {
    schemaVersion: value.schemaVersion,
    capturedAt: value.capturedAt,
    app: { ...value.app },
    os: { ...value.os },
  };
}

function safeScreenshot(value) {
  if (!value || !Buffer.isBuffer(value.bytes) || value.bytes.length === 0 || value.mimeType !== 'image/png') {
    return null;
  }
  return Object.freeze({
    bytes: Buffer.from(value.bytes),
    mimeType: 'image/png',
  });
}

function safeLog(value) {
  if (
    !value
    || typeof value.text !== 'string'
    || !Number.isSafeInteger(value.byteLength)
    || value.byteLength < 0
    || typeof value.truncated !== 'boolean'
    || !Number.isSafeInteger(value.redactionCount)
    || value.redactionCount < 0
  ) {
    return null;
  }
  // Collectors are not trusted merely because they run in the main process.
  // Scan their output independently so an incomplete redaction pass cannot
  // make sensitive text eligible for preview or future artifact creation.
  const scanned = scanBugReportText(value.text);
  if (!scanned.safe) return null;
  return Object.freeze({
    text: value.text,
    byteLength: Buffer.byteLength(value.text, 'utf8'),
    truncated: value.truncated,
    redactionCount: value.redactionCount,
  });
}

async function collectSafely(collector, source, normalize) {
  if (typeof collector !== 'function') return null;
  try {
    return normalize(await collector({
      webContentsId: source.webContentsId,
      windowId: source.windowId,
    }));
  } catch {
    return null;
  }
}

/**
 * Main-process authority for the bug-report lifecycle.
 *
 * Drafts deliberately retain future report resources as private placeholders.
 * Renderer callers receive snapshots only; filesystem paths, artifacts, and
 * privileged resource handles never cross this boundary.
 */
function createBugReportService({
  createId: createDraftId = createId,
  now = () => Date.now(),
  captureScreenshot,
  collectDiagnostics,
  collectLog,
} = {}) {
  const drafts = new Map();

  function safePreview(draft) {
    return {
      id: draft.id,
      state: draft.state,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      available: {
        screenshot: draft.screenshot !== null,
        diagnostics: draft.diagnostics !== null,
        log: draft.log !== null,
        reportMetadata: draft.reportMetadata !== null,
      },
      collection: {
        screenshot: draft.screenshot === null
          ? { available: false }
          : { available: true, mimeType: draft.screenshot.mimeType, byteLength: draft.screenshot.bytes.length },
        diagnostics: copyDiagnostics(draft.diagnostics),
        log: draft.log === null
          ? { available: false }
          : {
            available: true,
            byteLength: draft.log.byteLength,
            truncated: draft.log.truncated,
            redactionCount: draft.log.redactionCount,
          },
      },
    };
  }

  function canAccess(draft, senderWebContentsId) {
    // Binding the dedicated review window transfers renderer access. The
    // source renderer can no longer inspect or mutate a draft it did not
    // receive through that review boundary.
    if (draft.reviewWebContentsId !== null) {
      return senderWebContentsId === draft.reviewWebContentsId;
    }
    return senderWebContentsId === draft.source.webContentsId;
  }

  function findAccessibleDraft(id, senderWebContentsId) {
    if (typeof id !== 'string' || !id) return fail(ERROR.INVALID_DRAFT);
    const draft = drafts.get(id);
    if (!draft) return fail(ERROR.NOT_FOUND);
    if (!isPositiveInteger(senderWebContentsId) || !canAccess(draft, senderWebContentsId)) {
      return fail(ERROR.FORBIDDEN);
    }
    return { ok: true, draft };
  }

  return {
    async createDraft(source) {
      try {
        if (!source || !isPositiveInteger(source.webContentsId) || typeof source.windowId !== 'string' || !source.windowId) {
          return fail(ERROR.INVALID_OWNER);
        }

        const id = createDraftId();
        if (typeof id !== 'string' || !id || drafts.has(id)) return fail(ERROR.UNAVAILABLE);
        const timestamp = toIso(now);
        const draft = {
          id,
          state: DRAFT_STATE.DRAFT,
          createdAt: timestamp,
          updatedAt: timestamp,
          source: {
            webContentsId: source.webContentsId,
            windowId: source.windowId,
          },
          reviewWebContentsId: null,
          // Collected resources remain main-process-owned and are never
          // persisted merely because a draft was created.
          screenshot: null,
          diagnostics: null,
          log: null,
          reportMetadata: null,
        };
        drafts.set(draft.id, draft);
        const [screenshot, diagnostics, log] = await Promise.all([
          collectSafely(captureScreenshot, draft.source, safeScreenshot),
          collectSafely(collectDiagnostics, draft.source, safeDiagnostics),
          collectSafely(collectLog, draft.source, safeLog),
        ]);
        // A window can close while capture is in flight. Do not revive a draft
        // that its owner already retired.
        if (drafts.get(draft.id) !== draft) return fail(ERROR.NOT_FOUND);
        draft.screenshot = screenshot;
        draft.diagnostics = diagnostics;
        draft.log = log;
        draft.updatedAt = toIso(now);

        return { ok: true, draft: safePreview(draft) };
      } catch {
        return fail(ERROR.UNAVAILABLE);
      }
    },

    getPreview(id, senderWebContentsId) {
      const found = findAccessibleDraft(id, senderWebContentsId);
      return found.ok ? { ok: true, draft: safePreview(found.draft) } : found;
    },

    discardDraft(id, senderWebContentsId) {
      const found = findAccessibleDraft(id, senderWebContentsId);
      if (!found.ok) return found;
      drafts.delete(found.draft.id);
      return { ok: true };
    },

    /** Reserve the draft for a future dedicated review window. This remains
     * main-process-only so renderers cannot grant themselves access. */
    bindReviewWindow(id, reviewWebContentsId) {
      try {
        if (typeof id !== 'string' || !id) return fail(ERROR.INVALID_DRAFT);
        const draft = drafts.get(id);
        if (!draft) return fail(ERROR.NOT_FOUND);
        if (!isPositiveInteger(reviewWebContentsId)) return fail(ERROR.INVALID_OWNER);
        if (draft.reviewWebContentsId !== null) return fail(ERROR.REVIEW_ALREADY_BOUND);
        draft.reviewWebContentsId = reviewWebContentsId;
        draft.state = DRAFT_STATE.REVIEWING;
        draft.updatedAt = toIso(now);
        return { ok: true, draft: safePreview(draft) };
      } catch {
        return fail(ERROR.UNAVAILABLE);
      }
    },

    /** Main-process window retirement cannot leave an orphaned in-memory
     * draft behind. A future bound review window continues to own its draft. */
    discardUnreviewedDraftsForSource(sourceWebContentsId) {
      if (!isPositiveInteger(sourceWebContentsId)) return 0;
      let discarded = 0;
      for (const [id, draft] of drafts) {
        if (draft.source.webContentsId === sourceWebContentsId && draft.reviewWebContentsId === null) {
          drafts.delete(id);
          discarded += 1;
        }
      }
      return discarded;
    },

    /** Future review-window destruction uses the same owner-only cleanup. */
    discardDraftsForReviewWindow(reviewWebContentsId) {
      if (!isPositiveInteger(reviewWebContentsId)) return 0;
      let discarded = 0;
      for (const [id, draft] of drafts) {
        if (draft.reviewWebContentsId === reviewWebContentsId) {
          drafts.delete(id);
          discarded += 1;
        }
      }
      return discarded;
    },
  };
}

module.exports = {
  DRAFT_STATE,
  createBugReportService,
};
