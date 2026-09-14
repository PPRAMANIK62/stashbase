import { useQuery } from '@tanstack/react-query';

import type { ProjectRegistryPort } from '@/features/workspace/application/ports';
import { projectQuery } from '@/features/workspace/application/queries';

export function useProject(api: ProjectRegistryPort) {
  return useQuery(projectQuery(api));
}
