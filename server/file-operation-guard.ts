import { getScheduledConversion } from './conversion.ts';
import { toSourcePath } from './folder.ts';

export type InFlightFileAction = 'rename' | 'delete';

export interface InFlightRouteError {
  status: 409;
  body: {
    error: string;
    code: 'CONVERSION_IN_FLIGHT';
  };
}

export function inFlightFileOperationError(name: string, action: InFlightFileAction): InFlightRouteError | null {
  if (getScheduledConversion(toSourcePath(name))?.state !== 'running') return null;
  const verb = action === 'rename' ? 'Rename' : 'Delete';
  return {
    status: 409,
    body: {
      error: `This file is still processing. ${verb} it after processing finishes.`,
      code: 'CONVERSION_IN_FLIGHT',
    },
  };
}
