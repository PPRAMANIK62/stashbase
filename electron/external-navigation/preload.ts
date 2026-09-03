import {
  EXTERNAL_NAVIGATION_OPEN_CHANNEL,
  type ExternalNavigationResponse,
  externalNavigationRequestSchema,
  externalNavigationResponseSchema,
} from '../../shared/protocols/electron/external-navigation.ts';

export interface IpcRenderer {
  invoke(channel: string, payload: unknown): Promise<unknown>;
}

export interface ExternalNavigationPreload {
  open(url: string): Promise<ExternalNavigationResponse>;
}

const invalidResponse = (): ExternalNavigationResponse => ({
  failure: { kind: 'unavailable', message: 'The system browser returned an invalid response.' },
  ok: false,
});

export function createExternalNavigationPreload(
  ipcRenderer: IpcRenderer,
): ExternalNavigationPreload {
  return Object.freeze({
    async open(url: string) {
      const request = externalNavigationRequestSchema.parse({ url });
      try {
        const response = externalNavigationResponseSchema.safeParse(
          await ipcRenderer.invoke(EXTERNAL_NAVIGATION_OPEN_CHANNEL, request),
        );
        return response.success ? response.data : invalidResponse();
      } catch {
        return invalidResponse();
      }
    },
  });
}
