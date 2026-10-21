import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiList, apiSend } from '@/lib/api';
import type { PermissionCatalog, Role } from '@/types';

export const rolesKeys = {
  all: ['roles'] as const,
  list: (params: object) => ['roles', 'list', params] as const,
  detail: (id: string) => ['roles', 'detail', id] as const,
  catalog: ['roles', 'catalog'] as const,
};

export function useRoles(params: object = { limit: 100, sort: 'name' }) {
  return useQuery({
    queryKey: rolesKeys.list(params),
    queryFn: () => apiList<Role>('/roles', params),
    placeholderData: keepPreviousData,
  });
}

export function useRole(id: string) {
  return useQuery({
    queryKey: rolesKeys.detail(id),
    queryFn: async () => (await apiGet<Role>(`/roles/${id}`)).data,
  });
}

export function usePermissionCatalog() {
  return useQuery({
    queryKey: rolesKeys.catalog,
    queryFn: async () => (await apiGet<PermissionCatalog>('/roles/permissions')).data,
    staleTime: Infinity,
  });
}

export interface RoleInput {
  name: string;
  description?: string | null;
  permissionKeys?: string[];
}

export function useSaveRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: RoleInput }) =>
      (await apiSend<Role>(id ? 'patch' : 'post', id ? `/roles/${id}` : '/roles', data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rolesKeys.all }),
    onError: () => {},
  });
}

export function useSaveRolePermissions(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (permissionKeys: string[]) =>
      (await apiSend<Role>('put', `/roles/${id}/permissions`, { permissionKeys })).data,
    onSuccess: (role) => {
      queryClient.setQueryData(rolesKeys.detail(id), role);
      queryClient.invalidateQueries({ queryKey: ['roles', 'list'] });
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiSend('delete', `/roles/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rolesKeys.all }),
  });
}
