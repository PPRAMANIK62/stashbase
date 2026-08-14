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
}: {
  title: string;
  message: string;
  kind?: 'success' | 'error';
  autoReturn?: boolean;
  returnStatusUrl?: string;
}): string {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const returnStatusJson = JSON.stringify(returnStatusUrl ?? '').replace(/</g, '\\u003c');
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
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-width: 280px; min-height: 100vh; color: #18181b; background: radial-gradient(circle at 50% 8%, rgba(99, 102, 241, .10), transparent 36%), #f7f7f8; }
    .shell { min-height: 100vh; display: grid; place-items: center; padding: 32px 20px; }
    .stack { width: min(100%, 420px); text-align: center; }
    .brand { display: inline-flex; align-items: center; gap: 9px; margin-bottom: 18px; color: #3f3f46; font-size: 14px; font-weight: 650; letter-spacing: -.01em; }
    .brand-mark { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 7px; color: white; background: linear-gradient(145deg, #6366f1, #4f46e5); box-shadow: 0 5px 14px rgba(79, 70, 229, .22); }
    .brand-mark svg { width: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
    .card { padding: 34px 32px 30px; border: 1px solid rgba(24, 24, 27, .08); border-radius: 20px; background: rgba(255, 255, 255, .92); box-shadow: 0 18px 50px rgba(24, 24, 27, .09), 0 2px 8px rgba(24, 24, 27, .04); backdrop-filter: blur(14px); }
    .result-icon { display: grid; place-items: center; width: 52px; height: 52px; margin: 0 auto 20px; border-radius: 16px; color: ${isSuccess ? '#15803d' : '#b91c1c'}; background: ${isSuccess ? '#ecfdf3' : '#fef2f2'}; }
    .result-icon svg { width: 27px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
    h1 { margin: 0; font-size: 22px; line-height: 1.25; letter-spacing: -.025em; }
    .message { margin: 10px auto 0; max-width: 320px; color: #71717a; font-size: 14px; line-height: 1.6; }
    .return-area { margin-top: 25px; padding-top: 22px; border-top: 1px solid #eeeef0; }
    .status { min-height: 20px; margin: 0 0 13px; color: #71717a; font-size: 12px; line-height: 1.5; }
    .button { display: inline-flex; min-height: 42px; align-items: center; justify-content: center; gap: 8px; padding: 0 18px; border-radius: 11px; color: #fff; background: #18181b; box-shadow: 0 5px 14px rgba(24, 24, 27, .16); font-size: 14px; font-weight: 650; text-decoration: none; transition: transform .15s ease, background .15s ease, box-shadow .15s ease; }
    .button:hover { background: #27272a; box-shadow: 0 7px 18px rgba(24, 24, 27, .20); transform: translateY(-1px); }
    .button:focus-visible { outline: 3px solid rgba(99, 102, 241, .28); outline-offset: 3px; }
    .button svg { width: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    [hidden] { display: none !important; }
    @media (prefers-reduced-motion: reduce) { .button { transition: none; } }
  </style>
</head>
<body>
  <main class="shell">
    <div class="stack">
      <div class="brand"><span class="brand-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7.5h10M7 12h10M7 16.5h6"/></svg></span>StashBase</div>
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

      button.addEventListener('click', beginReturnAttempt);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void pollAcknowledgement();
      });

      if (!autoReturn) return;
      window.setTimeout(() => {
        if (!handedOff && document.visibilityState === 'visible' && document.hasFocus()) {
          beginReturnAttempt();
          window.location.href = '${APP_RETURN_URL}';
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
