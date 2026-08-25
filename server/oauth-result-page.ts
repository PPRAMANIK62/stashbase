const APP_RETURN_URL = 'stashbase://oauth-complete';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char] ?? char);
}

export function oauthResultPage({
  title,
  message,
  kind = 'success',
  autoReturn = false,
  returnStatusUrl,
  returnIntentUrl,
}: {
  title: string;
  message: string;
  kind?: 'success' | 'error';
  autoReturn?: boolean;
  returnStatusUrl?: string;
  returnIntentUrl?: string;
}): string {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const returnStatusJson = JSON.stringify(returnStatusUrl ?? '').replace(/</g, '\\u003c');
  const returnIntentJson = JSON.stringify(returnIntentUrl ?? '').replace(/</g, '\\u003c');
  const isSuccess = kind === 'success';
  const icon = isSuccess
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7.4 12.1 3 3L16.8 8.7"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7.5v5M12 16.5h.01"/></svg>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <title>${safeTitle}</title>
  <style>
    /* Standalone HTML cannot consume the renderer's CSS token layer, so
     * every value below RESTATES the light theme from
     * web-src/src/styles/globals.css by hand — cool grays, cyan accent,
     * the 4/6/10/20 radius tiers, the system sans stack. Change a token
     * there and this page follows in the same change. No colors outside
     * that palette (this page once wore template indigo + a black CTA,
     * which read as another product). */
    :root { color-scheme: light; font-family: -apple-system, system-ui, "PingFang SC", "Hiragino Sans", "Microsoft YaHei UI", "Noto Sans CJK SC", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-width: 280px; min-height: 100vh; color: #202427; background: #f3f5f7; }
    .shell { min-height: 100vh; display: grid; place-items: center; padding: 32px 20px; }
    .stack { width: min(100%, 420px); text-align: center; }
    .brand { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 18px; color: #202427; font-size: 14px; font-weight: 600; }
    .brand-mark { display: grid; place-items: center; width: 22px; height: 22px; }
    .brand-mark svg { width: 22px; height: 22px; }
    .card { padding: 34px 32px 30px; border: 1px solid #d9e0e3; border-radius: 20px; background: #ffffff; box-shadow: 0 8px 24px rgba(32, 36, 39, .10), 0 2px 8px rgba(32, 36, 39, .05); }
    .result-icon { display: grid; place-items: center; width: 52px; height: 52px; margin: 0 auto 20px; border-radius: 10px; color: ${isSuccess ? '#047857' : '#b91c1c'}; background: ${isSuccess ? 'rgba(4, 120, 87, .09)' : 'rgba(185, 28, 28, .08)'}; }
    .result-icon svg { width: 27px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
    h1 { margin: 0; font-size: 20px; line-height: 1.25; font-weight: 600; letter-spacing: -.01em; }
    .message { margin: 10px auto 0; max-width: 320px; color: #68737a; font-size: 14px; line-height: 1.6; }
    .return-area { margin-top: 25px; padding-top: 22px; border-top: 1px solid rgba(217, 224, 227, .8); }
    .status { min-height: 20px; margin: 0 0 13px; color: #68737a; font-size: 12px; line-height: 1.5; }
    .button { display: inline-flex; min-height: 40px; align-items: center; justify-content: center; gap: 8px; padding: 0 18px; border-radius: 10px; color: #ffffff; background: #0891b2; font-size: 14px; font-weight: 600; text-decoration: none; transition: background .15s ease; }
    .button:hover { background: #0782a0; }
    .button:focus-visible { outline: 3px solid rgba(8, 145, 178, .35); outline-offset: 3px; }
    .button svg { width: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    [hidden] { display: none !important; }
    @media (prefers-reduced-motion: reduce) { .button { transition: none; } }
  </style>
</head>
<body>
  <main class="shell">
    <div class="stack">
      <!-- The real product mark (CubeLogoIcon, icons.tsx) with the light
           tokens baked in: accent front edges, stroke-strong back edges.
           The previous mark was an indigo gradient tile from no brand of
           ours. -->
      <div class="brand"><span class="brand-mark"><svg viewBox="0 0 512 512" fill="none" aria-hidden="true"><g stroke="#aeb9bf" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><path d="M92 158 L92 342"/><path d="M92 342 L256 436"/></g><g stroke="#0891b2" stroke-width="23" stroke-linecap="round" stroke-linejoin="round"><path d="M92 158 L256 64 L338 111"/><path d="M92 158 L256 252 L420 158"/><path d="M420 158 L420 342"/><path d="M256 436 L420 342"/><path d="M256 342 L256 436"/></g></svg></span>StashBase</div>
      <section class="card" data-auto-return="${autoReturn ? 'true' : 'false'}" aria-labelledby="result-title">
        <div class="result-icon">${icon}</div>
        <h1 id="result-title">${safeTitle}</h1>
        <p class="message">${safeMessage}</p>
        <div class="return-area">
          <p class="status" id="return-status" aria-live="polite">${autoReturn ? 'Returning you to the app…' : 'Return to StashBase to try again.'}</p>
          <a class="button" id="return-button" href="${APP_RETURN_URL}"${autoReturn ? ' hidden' : ''}>
            Open StashBase
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 7l5 5-5 5"/></svg>
          </a>
        </div>
      </section>
    </div>
  </main>
  <script>
    (() => {
      const card = document.querySelector('.card');
      const button = document.getElementById('return-button');
      const status = document.getElementById('return-status');
      const autoReturn = card.dataset.autoReturn === 'true';
      const returnStatusUrl = ${returnStatusJson};
      const returnIntentUrl = ${returnIntentJson};
      let handedOff = false;
      let returnAttempted = false;

      const closeAfterAcknowledgement = () => {
        if (handedOff) return;
        handedOff = true;
        button.hidden = true;
        status.textContent = 'StashBase is open. You can close this page.';
        window.setTimeout(() => window.close(), 250);
      };

      const pollAcknowledgement = async () => {
        if (handedOff || !returnAttempted || !returnStatusUrl) return;
        try {
          const response = await fetch(returnStatusUrl, { cache: 'no-store' });
          const result = response.ok ? await response.json() : null;
          if (result && result.appReturned === true) {
            closeAfterAcknowledgement();
            return;
          }
        } catch { /* keep the fallback visible and retry */ }
        window.setTimeout(pollAcknowledgement, 300);
      };

      const beginReturnAttempt = () => {
        if (!returnAttempted) {
          returnAttempted = true;
          void pollAcknowledgement();
        }
        status.textContent = 'Opening StashBase…';
        window.setTimeout(() => {
          if (!handedOff) status.textContent = 'Could not open automatically. Try the button again.';
        }, 1600);
      };

      const openStashBase = async () => {
        beginReturnAttempt();
        if (returnIntentUrl) {
          try { await fetch(returnIntentUrl, { method: 'POST', cache: 'no-store' }); }
          catch { /* the native fallback can still open the app */ }
        }
        window.location.href = '${APP_RETURN_URL}';
      };

      button.addEventListener('click', (event) => {
        event.preventDefault();
        void openStashBase();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void pollAcknowledgement();
      });

      if (!autoReturn) return;
      window.setTimeout(() => {
        if (!handedOff && document.visibilityState === 'visible' && document.hasFocus()) {
          void openStashBase();
        }
      }, 1200);
      window.setTimeout(() => {
        if (handedOff) return;
        button.hidden = false;
        status.textContent = 'Didn’t return automatically?';
      }, 2800);
    })();
  </script>
</body>
</html>`;
}
