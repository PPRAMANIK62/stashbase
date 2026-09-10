/**
 * What the MCP page renders and can do.
 *
 * Every write here answers with the whole listener state the server ended up
 * in, so the page never has to guess what took effect: the answer replaces the
 * cached listener outright rather than triggering another read. The Docker
 * opt-in is the one control that moves before the server replies, which is why
 * this file also owns which of two overlapping writes is still allowed to put
 * a value back.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { settingsFailure } from '@/features/settings/application/failure-messages';
import type { McpAccessPort } from '@/features/settings/application/ports';
import { mcpAccessQuery, settingsQueryKeys } from '@/features/settings/application/queries';
import {
  mcpDockerSettling,
  mcpDockerState,
  type McpAccess,
  type McpDockerState,
  type McpHttpAccess,
} from '@/features/settings/domain/mcp-access';
import {
  anyBusy,
  firstCommandFailure,
  pollWhileBusy,
  useSettingsCommand,
} from '@/features/settings/hooks/use-settings-command';
import type { FailureView } from '@/shared/domain/feature-error';
import { writeToClipboard } from '@/shared/ui/clipboard';

const DOCKER_POLL_MS = 750;
const COPIED_MS = 1_500;

type McpCopyTarget = 'config' | 'loopback' | 'token' | 'docker';

export const MCP_COPY_FAILED =
  'StashBase could not reach the clipboard. Select the value and copy it manually.';

/** What each copy control puts on the clipboard. */
const COPY_TEXT: Readonly<Record<McpCopyTarget, (access: McpAccess) => string | null>> = {
  config: (access) => access.config,
  docker: (access) => access.http.dockerUrl,
  loopback: (access) => access.http.loopbackUrl,
  token: (access) => access.http.token,
};

/** One Docker opt-in write, and which attempt it is. */
interface DockerAccessWrite {
  readonly enabled: boolean;
  readonly generation: number;
}

export interface McpAccessViewModel {
  readonly access: McpAccess | null;
  /** Any write is open. */
  readonly busy: boolean;
  readonly copied: McpCopyTarget | null;
  readonly dockerState: McpDockerState;
  readonly failure: FailureView | null;
  readonly loading: boolean;
  readonly rotating: boolean;
  copy(target: McpCopyTarget): void;
  reload(): void;
  rotateToken(onDone?: () => void): void;
  setDockerAccess(enabled: boolean): void;
  setDockerPort(port: number): void;
}

export function useMcpAccess(port: McpAccessPort): McpAccessViewModel {
  const queryClient = useQueryClient();
  const query = useQuery({
    ...mcpAccessQuery(port),
    // The Docker listener comes up moments after the app server, so an
    // opted-in listener that has not settled yet is re-read until it does.
    refetchInterval: pollWhileBusy(
      (data: McpAccess) => mcpDockerSettling(data.http),
      DOCKER_POLL_MS,
    ),
  });

  const [copied, setCopied] = useState<McpCopyTarget | null>(null);
  const [copyFailure, setCopyFailure] = useState<FailureView | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newestWrite = useRef(0);
  const held = useRef<McpHttpAccess | null>(null);

  useEffect(
    () => () => {
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
    },
    [],
  );

  const cancelRead = () => queryClient.cancelQueries({ queryKey: settingsQueryKeys.mcpAccess });

  const writeHttp = (next: McpHttpAccess): void => {
    queryClient.setQueryData(settingsQueryKeys.mcpAccess, (previous: McpAccess | undefined) =>
      previous ? { ...previous, http: next } : previous,
    );
  };

  const rotate = useSettingsCommand('rotateToken', (_: void, signal) => port.rotateToken(signal), {
    onDone: writeHttp,
    onStart: cancelRead,
  });

  const dockerAccess = useSettingsCommand(
    'dockerAccess',
    ({ enabled }: DockerAccessWrite, signal) => port.setDockerAccess(enabled, signal),
    {
      onDone: writeHttp,
      onFailed: ({ generation }) => {
        // A newer write has answered since; putting this attempt's value back
        // would overwrite the state the server itself reported.
        if (generation !== newestWrite.current) return;
        if (held.current) writeHttp(held.current);
      },
      onStart: async ({ enabled }) => {
        await cancelRead();
        const current = queryClient.getQueryData<McpAccess>(settingsQueryKeys.mcpAccess);
        if (!current) return;
        held.current = current.http;
        writeHttp({ ...current.http, dockerAccess: enabled });
      },
    },
  );

  const dockerPort = useSettingsCommand(
    'dockerPort',
    (value: number, signal) => port.setDockerPort(value, signal),
    { onDone: writeHttp, onStart: cancelRead },
  );

  const access = query.data ?? null;

  const copy = (target: McpCopyTarget): void => {
    const text = access ? COPY_TEXT[target](access) : null;
    if (text === null) return;
    void writeToClipboard(text).then(
      () => {
        setCopyFailure(null);
        setCopied(target);
        if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => setCopied(null), COPIED_MS);
      },
      () => setCopyFailure({ message: MCP_COPY_FAILED, tone: 'input' }),
    );
  };

  return {
    access,
    busy: anyBusy(rotate, dockerAccess, dockerPort),
    copied,
    copy,
    dockerState: access ? mcpDockerState(access.http) : 'off',
    failure: query.isError
      ? settingsFailure(query.error)
      : (firstCommandFailure(rotate, dockerAccess, dockerPort) ?? copyFailure),
    loading: query.isPending,
    reload: () => void query.refetch(),
    rotateToken: (onDone) => rotate.run(undefined, () => onDone?.()),
    rotating: rotate.busy,
    setDockerAccess: (enabled) => {
      newestWrite.current += 1;
      dockerAccess.run({ enabled, generation: newestWrite.current });
    },
    setDockerPort: (value) => dockerPort.run(value),
  };
}
