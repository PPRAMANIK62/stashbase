import { useEffect, useRef, useState } from 'react';
import { errorMessage, type HostedAccountState, type HostedOAuthPurpose } from '@/common/api/api';
import { signInWithStashBase } from '@/common/lib/accountOAuth';
import { Button } from '@/common/components/ui/button';
import { StatusMessage } from '@/common/components/ui/status';

export function AccountSignInForm({
  onSignedIn,
  onBack,
  purpose = 'account',
}: {
  onSignedIn: (account: HostedAccountState) => void;
  onBack?: () => void;
  purpose?: HostedOAuthPurpose;
}) {
  const [busy, setBusy] = useState(true);
  const [browserOpened, setBrowserOpened] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const mountedRef = useRef(true);

  function start() {
    setBusy(true);
    setBrowserOpened(false);
    setError(null);
    void signInWithStashBase('google', {
      purpose,
      onBrowserOpened: () => { if (mountedRef.current) setBrowserOpened(true); },
    }).then((account) => {
      if (mountedRef.current) onSignedIn(account);
    }).catch((err: unknown) => {
      if (!mountedRef.current) return;
      setError(errorMessage(err));
      setBusy(false);
    });
  }

  useEffect(() => {
    mountedRef.current = true;
    if (!startedRef.current) {
      startedRef.current = true;
      start();
    }
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return (
    <div>
      {/* One quiet body line — the dialog above already carries the title,
       * so a second bold heading here just competed with it. The hand-off
       * is described from the user's seat (browser opens, finish there,
       * we continue); the vendor doing the OAuth plumbing is not part of
       * that story and never surfaces in copy. */}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Google sign-in opens in your browser. Finish there, and StashBase continues automatically.
      </p>
      {error && <StatusMessage tone="error" className="mt-2.5">{error}</StatusMessage>}
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        {/* Back stays usable while waiting — the wait happens in another
         * app, so this dialog must never trap the user behind it. */}
        {onBack && <Button variant="ghost" onClick={onBack}>Back</Button>}
        {/* Waiting is a STATE, not an action: a disabled primary with a
         * swapped label read as a broken button (washed accent + white
         * text). While the browser owns the flow there is nothing to
         * click here, so the button yields to a status line and returns
         * as the retry affordance on failure. */}
        {busy ? (
          // The app-wide working voice (globals.css .working-shimmer):
          // the sweep marks this line as live and makes it the dialog's
          // focal point without a spinner or a fake-disabled button.
          <span className="working-shimmer px-2 text-xs" role="status">
            {browserOpened ? 'Waiting for Google in your browser…' : 'Opening Google sign-in…'}
          </span>
        ) : (
          <Button onClick={start}>Continue with Google</Button>
        )}
      </div>
    </div>
  );
}
