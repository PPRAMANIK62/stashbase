interface TelemetryPreferences {
  enabled: boolean;
  noticeSeen: boolean;
  available: boolean;
}
export interface TelemetryPort {
  load(signal: AbortSignal): Promise<TelemetryPreferences>;
  update(
    change: { enabled?: boolean; noticeSeen?: true },
    signal: AbortSignal,
  ): Promise<TelemetryPreferences>;
}
