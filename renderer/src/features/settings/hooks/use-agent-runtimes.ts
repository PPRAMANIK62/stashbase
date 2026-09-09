/**
 * The Agents panel's state and commands.
 *
 * Preparation is per-runtime, so everything about it is keyed by agent id: the
 * abort lane a command runs in, whether that command is still open, and the
 * sentence its refusal reads as. Installing Claude Code therefore neither
 * aborts an install of Codex already running nor overwrites the failure Codex
 * left on its own row — both of which a single lane and a single mutation's
 * `variables` could not keep apart.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { settingsFailure } from '@/features/settings/application/failure-messages';
import type { AgentRuntimePort } from '@/features/settings/application/ports';
import {
  agentAllowanceQuery,
  settingsQueryKeys,
  agentCatalogQuery,
} from '@/features/settings/application/queries';
import type {
  AgentAllowance,
  AgentCatalog,
  AgentDebugControls,
  AgentDebugPatch,
  AgentRuntime,
} from '@/features/settings/domain/agent-catalog';
import { pollWhileBusy, useSettingsCommand } from '@/features/settings/hooks/use-settings-command';
import { useRequestSignals } from '@/lib/runtime/use-request-signals';
import type { AgentId } from '@/shared/domain/agent-id';
import type { FailureView } from '@/shared/domain/feature-error';

/** The commands a reader can aim at one runtime. Each opens a lane of its own
 *  per agent id, so two rows never share an abort. */
type RuntimeCommand = 'install' | 'login' | 'uninstall' | 'resetFirstRun';

/** One command in flight, or one that refused, for a single runtime. */
interface RuntimeCommandState {
  /** The command still open for this runtime, or null when none is. */
  readonly running: RuntimeCommand | null;
  /** What the last command left behind, or null when it did not refuse. */
  readonly refusal: { readonly command: RuntimeCommand; readonly failure: FailureView } | null;
}

type RuntimeCommands = Partial<Record<AgentId, RuntimeCommandState>>;

const IDLE: RuntimeCommandState = { refusal: null, running: null };

const CATALOG_POLL_MS = 500;

interface AgentCatalogView {
  readonly runtimes: readonly AgentRuntime[];
  /** Development-only controls, when the server reports them enabled. */
  readonly debug: AgentDebugControls | null;
  readonly failed: boolean;
  readonly loading: boolean;
}

interface AgentAllowanceView {
  readonly allowance: AgentAllowance | null;
  readonly failed: boolean;
}

export interface AgentRuntimesViewModel {
  readonly allowance: AgentAllowanceView;
  readonly catalog: AgentCatalogView;
  /** A debug write or a first-run reset is open. */
  readonly debugBusy: boolean;
  readonly debugFailure: FailureView | null;
  /** This runtime has a command of its own in flight. */
  busy(id: AgentId): boolean;
  /** The failure left on this runtime's row by its last preparation command. */
  failure(id: AgentId): FailureView | null;
  install(id: AgentId): void;
  login(id: AgentId): void;
  refreshAllowance(): void;
  refreshCatalog(): void;
  resetFirstRun(id: AgentId): void;
  uninstall(id: AgentId, onDone: () => void): void;
  uninstalling(id: AgentId | null): boolean;
  uninstallFailure(id: AgentId | null): FailureView | null;
  updateDebug(patch: AgentDebugPatch): void;
}

export function useAgentRuntimes(port: AgentRuntimePort): AgentRuntimesViewModel {
  const queryClient = useQueryClient();
  const signalFor = useRequestSignals<`${RuntimeCommand}:${AgentId}`>();
  const [commands, setCommands] = useState<RuntimeCommands>({});

  const catalog = useQuery({
    ...agentCatalogQuery(port),
    refetchInterval: pollWhileBusy(
      (data: AgentCatalog) =>
        data.runtimes.some((runtime) => runtime.preparation.kind === 'running'),
      CATALOG_POLL_MS,
    ),
  });

  const stashbaseReady =
    catalog.data?.runtimes.some(
      (runtime) => runtime.id === 'stashbase' && runtime.preparation.kind === 'ready',
    ) ?? false;

  // Appending the catalog's last-successful-fetch timestamp forces a refetch
  // whenever the catalog changes, in addition to `enabled` flipping true the
  // moment a stashbase runtime turns ready.
  const allowance = useQuery({
    ...agentAllowanceQuery(port),
    queryKey: [...settingsQueryKeys.agentAllowance, catalog.dataUpdatedAt] as const,
    enabled: stashbaseReady,
  });

  /** A command's response is the freshest truth about the catalog, so the poll
   *  that was already in flight is dropped before it is written: otherwise a
   *  refetch started before the command could land on top of it afterwards and
   *  put the row back the way it was. */
  const applyResponse = useCallback(
    async (response: AgentCatalog) => {
      await queryClient.cancelQueries({ queryKey: settingsQueryKeys.agentCatalog });
      queryClient.setQueryData(settingsQueryKeys.agentCatalog, response);
    },
    [queryClient],
  );

  const record = useCallback(
    (id: AgentId, state: RuntimeCommandState) => setCommands((open) => ({ ...open, [id]: state })),
    [],
  );

  /**
   * Runs one command for one runtime in that runtime's own lane, and leaves
   * either the response or the refusal on that runtime alone. A command whose
   * lane was aborted — the same command asked for again, or the panel closing
   * — writes nothing at all, so it cannot revive a row a newer call has moved
   * on from.
   */
  const run = useCallback(
    async (
      id: AgentId,
      command: RuntimeCommand,
      call: (signal: AbortSignal) => Promise<AgentCatalog>,
    ): Promise<boolean> => {
      const signal = signalFor(`${command}:${id}`);
      record(id, { refusal: null, running: command });
      try {
        const response = await call(signal);
        if (signal.aborted) return false;
        await applyResponse(response);
        record(id, IDLE);
        return true;
      } catch (error) {
        if (signal.aborted) return false;
        record(id, { refusal: { command, failure: settingsFailure(error) }, running: null });
        return false;
      }
    },
    [applyResponse, record, signalFor],
  );

  const updateDebug = useSettingsCommand(
    'updateDebug',
    (patch: AgentDebugPatch, signal) => port.updateDebug(patch, signal),
    { onDone: applyResponse },
  );

  const stateFor = (id: AgentId | null): RuntimeCommandState =>
    (id === null ? undefined : commands[id]) ?? IDLE;

  const refusalOf = (id: AgentId | null, wanted: (command: RuntimeCommand) => boolean) => {
    const refusal = stateFor(id).refusal;
    return refusal && wanted(refusal.command) ? refusal.failure : null;
  };

  const openStates = Object.values(commands).filter((state) => state !== undefined);
  const resetRefusal = openStates.find(
    (state) => state.refusal?.command === 'resetFirstRun',
  )?.refusal;
  const debug = catalog.data?.debug ?? null;

  return {
    allowance: {
      allowance: allowance.isSuccess ? allowance.data : null,
      failed: allowance.isError,
    },
    busy: (id) => stateFor(id).running !== null,
    catalog: {
      debug,
      failed: catalog.isError,
      loading: catalog.isLoading,
      runtimes: catalog.data?.runtimes ?? [],
    },
    debugBusy: updateDebug.busy || openStates.some((state) => state.running === 'resetFirstRun'),
    debugFailure: updateDebug.failure ?? resetRefusal?.failure ?? null,
    failure: (id) => refusalOf(id, (command) => command !== 'uninstall'),
    install: (id) =>
      void run(id, 'install', (signal) => port.prepareAgent(id, 'bootstrap', signal)),
    login: (id) => void run(id, 'login', (signal) => port.prepareAgent(id, 'login', signal)),
    refreshAllowance: () => void allowance.refetch(),
    refreshCatalog: () => void catalog.refetch(),
    resetFirstRun: (id) =>
      void run(id, 'resetFirstRun', async (signal) => {
        // One signal spans both calls: cancelling the reset must drop the
        // policy write and the runtime reset together.
        await port.updateDebug({ discoverySource: 'managed-only' }, signal);
        return port.resetManagedAgent(id, signal);
      }),
    uninstall: (id, onDone) => {
      void run(id, 'uninstall', (signal) => port.resetManagedAgent(id, signal)).then((done) => {
        if (done) onDone();
      });
    },
    uninstallFailure: (id) => refusalOf(id, (command) => command === 'uninstall'),
    uninstalling: (id) => stateFor(id).running === 'uninstall',
    updateDebug: (patch) => updateDebug.run(patch),
  };
}
