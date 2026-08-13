/**
 * Opening a link outside the app.
 *
 * The renderer must never navigate itself to an external URL — that would
 * replace the app with a web page and there is no way back. Under Electron
 * the preload bridge hands the URL to the OS browser; in a plain browser
 * (dev, or the web build) a noopener window is the equivalent. Callers get
 * one function and do not have to know which host they are running in.
 */

import links from '../../../shared/links.json';

interface ExternalLinkBridge {
  openExternal?: (url: string) => Promise<boolean>;
}

/** The community server, linked from the sidebar's bottom row and the
 *  Help menu. Both sides read the same `shared/links.json`, so the main
 *  process and the renderer cannot drift to different invites. */
export const DISCORD_INVITE_URL = links.discord;

export function openExternalUrl(url: string): void {
  const bridge = (window as { electron?: ExternalLinkBridge }).electron;
  if (bridge?.openExternal) {
    void bridge.openExternal(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
