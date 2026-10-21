import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiList, apiSend, fetchAllPages } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { AuthUser, User, UserStatus } from '@/types';

export interface UserInput {
  name: string;
  email: string;
  phone?: string | null;
  password?: string;
  status: UserStatus;
  language: 'en' | 'bn';
  roleIds: string[];
  branchIds: string[];
  defaultBranchId?: string | null;
}

export const usersKeys = {
  all: ['users'] as const,
  list: (params: object) => ['users', 'list', params] as const,
  detail: (id: string) => ['users', 'detail', id] as const,
};

export function useUsers(params: object) {
  return useQuery({
    queryKey: usersKeys.list(params),
    queryFn: () => apiList<User>('/users', params),
    placeholderData: keepPreviousData,
  });
}

export const fetchAllUsers = (params: object) => fetchAllPages<User>('/users', params);

export function useUser(id: string | null) {
  return useQuery({
    queryKey: usersKeys.detail(id ?? ''),
    queryFn: async () => (await apiGet<User>(`/users/${id}`)).data,
    enabled: Boolean(id),
  });
}

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: usersKeys.all });
    queryClient.invalidateQueries({ queryKey: ['roles'] }); // user counts per role
  };
}

export function useSaveUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: Partial<UserInput> }) =>
      (await apiSend<User>(id ? 'patch' : 'post', id ? `/users/${id}` : '/users', data)).data,
    onSuccess: (user) => {
      invalidate();
      // Editing yourself changes your own session data (roles, branches…).
      if (user.id === useAuthStore.getState().user?.id) {
        apiGet<AuthUser>('/auth/me').then((r) => useAuthStore.getState().setUser(r.data));
      }
    },
    onError: () => {},
  });
}

export function useSetUserStatus() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      apiSend<User>('patch', `/users/${id}/status`, { status }),
    onSuccess: invalidate,
  });
}

export function useDeleteUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (id: string) => apiSend('delete', `/users/${id}`),
    onSuccess: invalidate,
  });
}
