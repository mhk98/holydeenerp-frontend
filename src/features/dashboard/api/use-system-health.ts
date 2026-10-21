import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiResponse } from '@/types';

export interface SystemHealth {
  status: 'ok' | 'degraded';
  app: string;
  env: string;
  uptimeSec: number;
  timestamp: string;
  checks: { database: { status: 'up' | 'down'; latencyMs?: number; error?: string } };
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ['system', 'health'],
    // /health/ready answers 503 with a valid body when the DB is down, so accept it.
    queryFn: async () =>
      (
        await api.get<ApiResponse<SystemHealth>>('/health/ready', {
          validateStatus: (s) => s === 200 || s === 503,
        })
      ).data.data,
    refetchInterval: 30_000,
    retry: false,
  });
}
