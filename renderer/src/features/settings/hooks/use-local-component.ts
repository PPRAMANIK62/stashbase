import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  localComponentDescription,
  settingsFailure,
} from '@/features/settings/application/failure-messages';
import type { LocalComponentPort } from '@/features/settings/application/ports';
import { settingsQueryKeys } from '@/features/settings/application/queries';
import { useSettingsCommand } from '@/features/settings/hooks/use-settings-command';
import type { FailureView } from '@/shared/domain/feature-error';

export interface LocalComponentViewModel {
  readonly status: 'not-installed' | 'downloading' | 'installed' | 'failed' | null;
  readonly description: string;
  readonly busy: boolean;
  readonly canRetry: boolean;
  readonly failure: FailureView | null;
  retry(): void;
  reload(): void;
}

export function useLocalComponent(
  port: LocalComponentPort | undefined,
  visible: boolean,
): LocalComponentViewModel | null {
  const client = useQueryClient();
  const queryKey = settingsQueryKeys.localComponent;
  const query = useQuery({
    enabled: Boolean(port) && visible,
    queryFn: ({ signal }) => port?.load(signal) ?? null,
    queryKey,
    // Status reads never initiate downloads. Poll while visible so another
    // window's Retry or a preparation request is reflected here too.
    refetchInterval: visible ? 1_000 : false,
    retry: false,
  });
  const retry = useSettingsCommand(
    'retry-component',
    async (_: void, signal) => port?.retry(signal),
    {
      onDone: (value) => {
        client.setQueryData(queryKey, value);
      },
      onSettled: () => void client.invalidateQueries({ queryKey }),
    },
  );
  if (!port) return null;
  const busy = retry.busy || query.data?.status === 'downloading';
  return {
    busy,
    status: query.data?.status ?? null,
    canRetry: query.data?.status === 'failed' && query.data.error !== 'unsupported-system',
    description: query.data ? localComponentDescription(query.data) : 'Loading component status…',
    failure: retry.failure ?? (query.isError ? settingsFailure(query.error) : null),
    reload: () => void query.refetch(),
    retry: () => {
      if (!busy) retry.run();
    },
  };
}
