import { useQuery, useQueryClient } from '@tanstack/react-query';

import { settingsFailure } from '@/features/settings/application/failure-messages';
import type { TelemetryPort } from '@/features/settings/application/telemetry-port';
import { useSettingsCommand } from '@/features/settings/hooks/use-settings-command';

const queryKey = ['settings', 'telemetry'] as const;
export function useTelemetry(port: TelemetryPort) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => port.load(signal),
    retry: false,
    refetchOnWindowFocus: true,
  });
  const command = useSettingsCommand(
    'telemetry',
    (change: { enabled?: boolean; noticeSeen?: true }, signal) => port.update(change, signal),
    {
      onStart: () => client.cancelQueries({ queryKey }),
      onDone: (saved) => {
        client.setQueryData(queryKey, saved);
      },
      onSettled: () => client.invalidateQueries({ queryKey }),
    },
  );
  return {
    preferences: query.data,
    busy: query.isPending || command.busy,
    failure: command.failure ?? (query.isError ? settingsFailure(query.error) : null),
    change: command.run,
  };
}
