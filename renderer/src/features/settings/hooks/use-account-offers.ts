/**
 * The one-time sign-in banner the window strip carries while signed out. It is
 * shown until the reader signs in or declines it, and the host remembers that
 * across launches, so it never returns after "Not now". The sidebar's account
 * row stays the account's only home; the banner only points at it.
 */
import { useAccountView } from '@/features/settings/hooks/account-context';

export interface AccountOfferNotice {
  readonly action: { readonly label: string; readonly onAct: () => void } | null;
  readonly dismissLabel: string;
  readonly message: string;
  readonly onDismiss: (() => void) | null;
  readonly tone: 'capability';
}

export function useAccountOffers(): readonly AccountOfferNotice[] {
  const account = useAccountView();
  const person = account.account;
  if (!person || person.signedIn || !person.offers.includes('sign-in')) return [];
  if (account.signInPending) {
    return [
      {
        action: account.canStopWaiting
          ? { label: 'Stop waiting', onAct: account.stopWaiting }
          : null,
        dismissLabel: 'Not now',
        message: 'Finish signing in in your browser.',
        onDismiss: null,
        tone: 'capability',
      },
    ];
  }
  return [
    {
      action: { label: 'Sign in', onAct: account.signIn },
      dismissLabel: 'Not now',
      message: 'Sign in for free Default Agent credits, valid for 7 days.',
      onDismiss: () => account.markOfferSeen('sign-in'),
      tone: 'capability',
    },
  ];
}
