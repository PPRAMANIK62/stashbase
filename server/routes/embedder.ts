/**
 * Embedder routes: manage the global embedding provider key and validate
 * a key without persisting it.
 *
 * Search by meaning uses an OpenAI or OpenRouter key supplied by the user.
 * Each Folder is configured as one MFS Internal namespace.
 */
import express from 'express';
import { logger, errorMessage } from '../log.ts';
import { getCurrentFolder } from '../folder.ts';
import {
  getEmbedderConfig,
  isEmbedderProvider,
  setApiKey,
  shouldBackfillAfterKeyChange,
} from '../app-config.ts';
import type { EmbedderProvider } from '../app-config.ts';
import { bootBindAllFolders, reconcileProjectFolders, resetIndexerRuntime } from '../state.ts';
import { sendError, validateEmbedderKey } from '../http.ts';
import type { ApiKeySaveResult, EmbedderState } from '../../shared/embedding.ts';

const log = logger('routes/embedder');

function parseProvider(raw: unknown, fallback: EmbedderProvider): EmbedderProvider | null {
  if (raw == null || raw === '') return fallback;
  return isEmbedderProvider(raw) ? raw : null;
}

function providerLabel(provider: EmbedderProvider): string {
  return provider === 'openrouter' ? 'OpenRouter' : 'OpenAI';
}

/** Compatibility aliases for older HTTP clients. Neither field is an
 * independent source selection or proof of successful provider authentication. */
function withLegacyAliases<T extends EmbedderState>(state: T) {
  return { ...state, source: state.provider, authorized: state.hasKey };
}

export function mount(app: express.Express): void {
  // Embedder status: active provider + whether a key is configured.
  app.get('/api/embedder', async (_req, res) => {
    const cfg = getEmbedderConfig();
    const state: EmbedderState = {
      provider: cfg.provider,
      hasKey: !!cfg.apiKey,
      model: cfg.model,
    };
    res.json(withLegacyAliases(state));
  });

  // Set / rotate the active embedding key. A definite provider rejection
  // blocks the save so a typo can't blow away a working key. A network
  // / transient validation failure still saves the key: offline/proxied
  // machines need to configure first and let indexing report connectivity.
  app.put('/api/embedder/key', async (req, res) => {
    const current = getEmbedderConfig();
    const provider = parseProvider(req.body?.provider, current.provider);
    if (!provider) return res.status(400).json({ error: 'unknown embedder provider' });
    const rawKey = typeof req.body?.key === 'string'
      ? req.body.key
      : typeof req.body?.openaiKey === 'string'
        ? req.body.openaiKey
        : '';
    const key = rawKey.trim();
    if (!key) return res.status(400).json({ error: 'key required' });
    const check = await validateEmbedderKey(provider, key);
    const warning = check.ok ? undefined : check.error;
    if (!check.ok && check.status < 500) return res.status(check.status).json({ error: check.error });
    const previous = getEmbedderConfig();
    const shouldBackfill = shouldBackfillAfterKeyChange(
      previous.provider,
      provider,
      !!previous.apiKey,
    );
    try {
      setApiKey(key, provider);
    } catch (err: unknown) {
      sendError(res, err);
      return;
    }
    try {
      await resetIndexerRuntime({ forgetBindings: true });
      await bootBindAllFolders();
      if (shouldBackfill) {
        const cur = getCurrentFolder();
        log.info(`${providerLabel(provider)} key set: starting semantic backfill${cur ? ` (active folder: ${cur})` : ''}`);
        void reconcileProjectFolders(`${providerLabel(provider)} embedder key set`)
          .catch((err: unknown) => {
            log.warn(`key set: semantic backfill failed: ${errorMessage(err)}`);
          });
      } else {
        log.info(`${providerLabel(provider)} key updated; existing embedding index remains valid`);
      }
    } catch (err: unknown) {
      log.warn(`key set: runtime reset/rebind failed: ${errorMessage(err)}`);
    }
    const saved = getEmbedderConfig();
    const result: ApiKeySaveResult = {
      hasKey: true,
      provider: saved.provider,
      model: saved.model,
      backfillStarted: shouldBackfill,
      ...(warning ? { warning } : {}),
    };
    res.json(withLegacyAliases(result));
  });

  // Remove the key: automatic searches use grep; explicit hybrid reports
  // missing configuration. Existing vectors remain stored.
  app.delete('/api/embedder/key', async (_req, res) => {
    try {
      setApiKey(undefined);
    } catch (err: unknown) {
      sendError(res, err);
      return;
    }
    try {
      await resetIndexerRuntime({ forgetBindings: true });
      await bootBindAllFolders();
    } catch (err: unknown) {
      log.warn(`key delete: runtime reset failed: ${errorMessage(err)}`);
    }
    const cfg = getEmbedderConfig();
    res.json(withLegacyAliases({ hasKey: false, provider: cfg.provider, model: cfg.model }));
  });
}
