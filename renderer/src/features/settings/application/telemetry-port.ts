interface TelemetryPreferences {
  enabled: boolean;
  available: boolean;
}
export interface TelemetryPort {
  load(signal: AbortSignal): Promise<TelemetryPreferences>;
  update(change: { enabled: boolean }, signal: AbortSignal): Promise<TelemetryPreferences>;
}
