import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Branch } from '@/types';

/** Active branches of the company (pickers). */
export function useBranches(enabled = true) {
  return useQuery({
    queryKey: ['branches'],
    queryFn: async () => (await apiGet<Branch[]>('/branches')).data,
    staleTime: 5 * 60_000,
    enabled,
  });
}
