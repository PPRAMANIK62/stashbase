import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { SEARCH_SETUP_INVITATION_VERSION } from '@/features/settings/application/ports';
import { ANSWERED_SEARCH_SETUP_VERSION, onboardingPort } from '@/test/fakes/settings';
import { createTestQueryClient, queryWrapper } from '@/test/query';

import {
  useSearchSetupInvitation,
  type SearchSetupInvitationInput,
} from './use-search-setup-invitation';

afterEach(cleanup);

const OFFERED: SearchSetupInvitationInput = { configured: false, folderActive: true };

function mount(port = onboardingPort(), input: SearchSetupInvitationInput = OFFERED) {
  return renderHook(() => useSearchSetupInvitation(port, input), {
    wrapper: queryWrapper(createTestQueryClient()),
  });
}

const unanswered = () =>
  onboardingPort({ load: async () => ({ searchSetupInvitationVersion: null }) });

describe('useSearchSetupInvitation', () => {
  // A fake cannot import a feature's runtime value, so the two constants are
  // pinned here. Raising one without the other would quietly re-offer the
  // invitation inside every unrelated composition test.
  it('keeps the fakes in step with the revision this build offers', () => {
    expect(ANSWERED_SEARCH_SETUP_VERSION).toBe(SEARCH_SETUP_INVITATION_VERSION);
  });

  it('offers once a folder is active and nothing has been answered', async () => {
    const hook = mount(unanswered());
    await waitFor(() => expect(hook.result.current.open).toBe(true));
  });

  it('never offers before the stored answer has loaded', () => {
    expect(mount(unanswered()).result.current.open).toBe(false);
  });

  it('stays closed for a reader who already answered', async () => {
    const hook = mount();
    await waitFor(() => expect(hook.result.current.open).toBe(false));
    expect(hook.result.current.open).toBe(false);
  });

  it('never offers while the folder readiness has not answered', async () => {
    const hook = mount(unanswered(), { configured: null, folderActive: true });
    await waitFor(() => expect(hook.result.current.open).toBe(false));
  });

  it('has nothing to offer once a source is configured', async () => {
    const hook = mount(unanswered(), { configured: true, folderActive: true });
    await waitFor(() => expect(hook.result.current.open).toBe(false));
  });

  it('never opens in a bare Library window', async () => {
    const hook = mount(unanswered(), { configured: false, folderActive: false });
    await waitFor(() => expect(hook.result.current.open).toBe(false));
  });

  it('closes on the answer and records the revision durably', async () => {
    const port = unanswered();
    const hook = mount(port);
    await waitFor(() => expect(hook.result.current.open).toBe(true));

    act(() => hook.result.current.answer());

    expect(hook.result.current.open).toBe(false);
    await waitFor(() =>
      expect(port.answerSearchSetup).toHaveBeenCalledWith(
        SEARCH_SETUP_INVITATION_VERSION,
        expect.anything(),
      ),
    );
  });

  it('answers once, however many times the reader clicks', async () => {
    const port = unanswered();
    const hook = mount(port);
    await waitFor(() => expect(hook.result.current.open).toBe(true));

    act(() => hook.result.current.answer());
    act(() => hook.result.current.answer());

    await waitFor(() => expect(port.answerSearchSetup).toHaveBeenCalledTimes(1));
  });
});
