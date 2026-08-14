import express from 'express';
import {
  getEmbedderConfig,
  getHostedAccountSession,
  setEmbeddingSource,
} from '../app-config.ts';
import {
  hostedAccountState,
  requestEmailOtp,
  signOutHostedAccount,
  verifyEmailOtp,
} from '../hosted-account.ts';
import { startHostedEmbeddingBroker } from '../hosted-embedding-broker.ts';
import { errorMessage, logger } from '../log.ts';
import { bootBindAllFolders, reconcileLibraryFolders, resetIndexerRuntime } from '../state.ts';

const log = logger('routes/account');

async function activateHostedSource(reason: string): Promise<boolean> {
  await startHostedEmbeddingBroker();
  const hadDirectKey = !!getEmbedderConfig().apiKey;
  setEmbeddingSource('stashbase-account');
  try {
    await resetIndexerRuntime({ forgetBindings: true });
    await bootBindAllFolders();
    void reconcileLibraryFolders(reason).catch((error: unknown) => {
      log.warn(`${reason}: semantic backfill failed: ${errorMessage(error)}`);
    });
  } catch (error: unknown) {
    log.warn(`${reason}: runtime reset/rebind failed: ${errorMessage(error)}`);
  }
  return !hadDirectKey;
}

export function mount(app: express.Express): void {
  app.get('/api/account', async (req, res) => {
    const refresh = req.query.refresh === '1';
    res.json(await hostedAccountState(refresh));
  });

  app.post('/api/account/otp', async (req, res) => {
    try {
      await requestEmailOtp(typeof req.body?.email === 'string' ? req.body.email : '');
      res.json({ ok: true });
    } catch (error: unknown) {
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  app.post('/api/account/verify', async (req, res) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email : '';
      const token = typeof req.body?.token === 'string' ? req.body.token : '';
      await verifyEmailOtp(email, token);
      const backfillStarted = await activateHostedSource('StashBase account activated');
      res.json({ ...(await hostedAccountState(true)), backfillStarted });
    } catch (error: unknown) {
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  app.put('/api/account/source', async (_req, res) => {
    try {
      if (!getHostedAccountSession()) return res.status(401).json({ error: 'Sign in first.' });
      const backfillStarted = await activateHostedSource('StashBase account source selected');
      res.json({ ...(await hostedAccountState(true)), backfillStarted });
    } catch (error: unknown) {
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  app.delete('/api/account', async (_req, res) => {
    const wasActive = (await hostedAccountState(false)).active;
    await signOutHostedAccount();
    if (wasActive) {
      try {
        await resetIndexerRuntime({ forgetBindings: true });
        await bootBindAllFolders();
      } catch (error: unknown) {
        log.warn(`sign out: runtime reset failed: ${errorMessage(error)}`);
      }
    }
    res.json({ signedIn: false, active: false });
  });
}
