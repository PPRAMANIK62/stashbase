/** The Default Agent subscription inside the Default group: the account's
 *  plan, the tiers it can buy, or the wait for a browser payment to confirm. */
import { Button } from '@/components/ui/button';
import {
  billingPaid,
  billingPrice,
  billingSubscribed,
  type BillingStatus,
} from '@/features/settings/domain/billing';
import type { BillingViewModel } from '@/features/settings/hooks/use-billing';
import { SettingsMessage, SettingsRow } from '@/features/settings/ui/rows';
import { FailureNotice } from '@/shared/ui/failure-notice';

function paidDate(value: string): string {
  return new Date(value).toLocaleDateString([], { dateStyle: 'medium' });
}

function subscriptionDetail(status: BillingStatus): string {
  if (billingPaid(status) && status.paidThrough) {
    const plan = status.planName ?? 'Paid plan';
    return status.cancelAtPeriodEnd
      ? `${plan} · Ends ${paidDate(status.paidThrough)}`
      : `${plan} · Paid through ${paidDate(status.paidThrough)}`;
  }
  return 'Paid credits are not active. Use Manage to check payment.';
}

export function SubscriptionRows({ billing }: { billing: BillingViewModel }) {
  const { status } = billing;
  const failure = billing.failure && <FailureNotice className="mt-1" failure={billing.failure} />;

  if (billing.confirming) {
    return (
      <SettingsRow
        as="li"
        detail={
          billing.confirming === 'waiting'
            ? 'Waiting for payment in your browser.'
            : 'Still confirming your subscription. Refresh to check again.'
        }
        title="Subscription"
        trail={
          <>
            {billing.confirming === 'slow' && (
              <Button onClick={billing.refresh} size="compact" variant="tertiary">
                Refresh
              </Button>
            )}
            <Button onClick={billing.stopWaiting} size="compact" variant="ghost">
              Stop waiting
            </Button>
          </>
        }
      />
    );
  }

  if (status === null) {
    return billing.statusFailed ? (
      <SettingsMessage
        as="li"
        message="Could not load your subscription."
        onRetry={billing.refresh}
      />
    ) : (
      <SettingsMessage as="li" message="Checking subscription…" />
    );
  }

  if (billingSubscribed(status)) {
    return (
      <SettingsRow
        as="li"
        detail={subscriptionDetail(status)}
        title="Subscription"
        trail={
          <Button
            disabled={billing.busy}
            loading={billing.busy}
            onClick={billing.manage}
            size="compact"
            variant="tertiary"
          >
            Manage
          </Button>
        }
      >
        {failure}
      </SettingsRow>
    );
  }

  return (
    <>
      <SettingsRow
        as="li"
        detail="Free. Have a promotion code? Enter it on the payment page."
        title="Subscription"
      >
        {failure}
      </SettingsRow>
      {billing.plansFailed && (
        <SettingsMessage
          as="li"
          message="Plans are unavailable right now."
          onRetry={billing.refresh}
        />
      )}
      {billing.plans.map((plan) => (
        <SettingsRow
          as="li"
          detail={`${billingPrice(plan)} · More Default Agent credits every week`}
          key={plan.priceId}
          title={plan.name}
          titleTone={plan.available ? 'default' : 'muted'}
          trail={
            <Button
              disabled={billing.busy || !plan.available}
              onClick={() => billing.subscribe(plan.priceId)}
              size="compact"
              variant="tertiary"
            >
              {plan.available ? 'Subscribe' : 'Coming soon'}
            </Button>
          }
        />
      ))}
    </>
  );
}
