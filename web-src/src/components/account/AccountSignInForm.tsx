import { useRef, useState } from 'react';
import { api, errorMessage, type HostedAccountState } from '../../api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { StatusMessage } from '../ui/status';
import { notifyAccountChanged } from '../../accountEvents';

export function AccountSignInForm({
  onSignedIn,
  onBack,
}: {
  onSignedIn: (account: HostedAccountState) => void;
  onBack?: () => void;
}) {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      await api.requestAccountOtp(email);
      setSent(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const account = await api.verifyAccountOtp(email, token);
      notifyAccountChanged();
      onSignedIn(account);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {!sent ? (
        <>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="stashbase-account-email">Email</label>
          <Input
            id="stashbase-account-email"
            ref={inputRef}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            disabled={busy}
            onChange={(event) => { setEmail(event.target.value); setError(null); }}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void sendCode(); } }}
          />
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            We’ll email a one-time code. New addresses create an account after verification.
          </p>
        </>
      ) : (
        <>
          <div className="mb-2 text-sm text-muted-foreground">Code sent to <span className="font-medium text-foreground">{email}</span></div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="stashbase-account-code">Verification code</label>
          <Input
            id="stashbase-account-code"
            ref={inputRef}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Enter code"
            value={token}
            disabled={busy}
            onChange={(event) => { setToken(event.target.value); setError(null); }}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void verify(); } }}
          />
        </>
      )}
      {error && <StatusMessage tone="error" className="mt-2.5">{error}</StatusMessage>}
      <div className="mt-3.5 flex items-center justify-between gap-2">
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
          disabled={busy}
          onClick={() => {
            if (sent) { setSent(false); setToken(''); setError(null); }
            else onBack?.();
          }}
        >{sent ? 'Use another email' : onBack ? 'Back' : ''}</button>
        <Button disabled={busy || (sent ? !token.trim() : !email.trim())} onClick={() => { void (sent ? verify() : sendCode()); }}>
          {busy ? 'Please wait…' : sent ? 'Verify and sign in' : 'Email me a code'}
        </Button>
      </div>
    </div>
  );
}
