'use strict';

/**
 * Coordinates the renderer durability boundary before a downloaded update is
 * allowed to close application windows. Electron main supplies native-window
 * adapters; this module owns the all-or-nothing approval and rollback rule.
 */
function createUpdateWindowBarrier(options) {
  const {
    getWindows,
    isLiveWindow,
    shouldRequestFlush,
    requestFlush,
    isWindowEnabled,
    setWindowEnabled,
    approveClose,
    revokeCloseApproval,
    onBlocked = async () => {},
  } = options;
  const updateApprovedWindows = new Set();
  const enabledWindows = new Map();
  let active = null;

  async function flushWindow(win) {
    if (!shouldRequestFlush(win)) return true;
    try {
      return await requestFlush(win) === true;
    } catch {
      return false;
    }
  }

  async function prepare() {
    if (active) return false;
    const attempt = {};
    active = attempt;
    const liveWindows = [...getWindows()].filter((win) => isLiveWindow(win));
    // Lock before asking for saves: native installers can prepare asynchronously
    // after approval, and no new user edit may invalidate those replies.
    for (const win of liveWindows) {
      enabledWindows.set(win, isWindowEnabled(win));
      setWindowEnabled(win, false);
    }
    const results = await Promise.all(liveWindows.map((win) => flushWindow(win)));
    if (active !== attempt) return false;
    if (!results.every(Boolean)) {
      revoke();
      try {
        await onBlocked();
      } catch {
        // Failure presentation must not turn a recoverable save refusal into
        // an updater error. The downloaded update remains ready for retry.
      }
      return false;
    }

    for (const win of liveWindows) {
      if (!isLiveWindow(win)) continue;
      approveClose(win);
      updateApprovedWindows.add(win);
    }
    return true;
  }

  function revoke() {
    for (const win of updateApprovedWindows) revokeCloseApproval(win);
    updateApprovedWindows.clear();
    for (const [win, enabled] of enabledWindows) {
      if (isLiveWindow(win)) setWindowEnabled(win, enabled);
    }
    enabledWindows.clear();
    active = null;
  }

  return { prepare, revoke, isActive: () => active !== null };
}

/**
 * Main installs the replacement window boundary after the update manager
 * already exists, so `lifecycle` is a thunk resolved per call.
 */
function createWindowLifecycleUpdateBarrier({ lifecycle, getWindows, isLiveWindow, onBlocked }) {
  return createUpdateWindowBarrier({
    getWindows,
    isLiveWindow,
    shouldRequestFlush: (win) => lifecycle()?.hasLoadedRenderer(win) === true,
    requestFlush: (win) => lifecycle().requestContextRelease(win, 'update-install'),
    isWindowEnabled: (win) => win.isEnabled(),
    setWindowEnabled: (win, enabled) => win.setEnabled(enabled),
    approveClose: (win) => lifecycle()?.approveClose(win),
    revokeCloseApproval: (win) => lifecycle()?.revokeCloseApproval(win),
    onBlocked,
  });
}

module.exports = { createUpdateWindowBarrier, createWindowLifecycleUpdateBarrier };
