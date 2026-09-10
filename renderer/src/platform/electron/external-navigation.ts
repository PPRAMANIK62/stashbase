import type { ExternalNavigationResponse } from '@/protocols/electron/external-navigation';

export interface ExternalNavigationBridge {
  open(url: string): Promise<ExternalNavigationResponse>;
}

export interface ExternalNavigation {
  open(url: string): Promise<boolean>;
}

export function createExternalNavigation(bridge: ExternalNavigationBridge): ExternalNavigation {
  return {
    async open(url) {
      const response = await bridge.open(url);
      return response.ok;
    },
  };
}
