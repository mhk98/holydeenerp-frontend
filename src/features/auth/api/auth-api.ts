import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiGet, apiSend, toApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { ApiResponse, AuthUser } from '@/types';

export interface LoginInput {
  email: string;
  password: string;
}

type LoginResult =
  | { requiresTwoFactor: true; challengeToken: string }
  | { requiresTwoFactor?: false; accessToken: string; user: AuthUser };

export interface Session {
  id: string;
  deviceName: string | null;
  ip: string | null;
  lastUsedAt: string;
  expiresAt: string;
  current: boolean;
}

export interface LoginAttempt {
  id: string;
  ip: string | null;
  deviceName: string | null;
  success: boolean;
  failureReason: string | null;
  createdAt: string;
}

const noRefresh = { skipAuthRefresh: true };
const startSession = (data: LoginResult) => {
  if (!data.requiresTwoFactor) useAuthStore.getState().setSession(data.user, data.accessToken);
  return data;
};

export function useLogin() {
  return useMutation({
    mutationFn: async (input: LoginInput) =>
      startSession((await apiSend<LoginResult>('post', '/auth/login', input, noRefresh)).data),
    onError: () => {},
  });
}

export function useVerifyTwoFactorLogin() {
  return useMutation({
    mutationFn: async (input: { challengeToken: string; code: string }) =>
      startSession((await apiSend<LoginResult>('post', '/auth/login/2fa', input, noRefresh)).data),
    onError: () => {},
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiSend('post', '/auth/logout', undefined, noRefresh),
    onSettled: () => {
      useAuthStore.getState().clear();
      queryClient.clear();
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: { email: string }) => apiSend('post', '/auth/forgot-password', input, noRefresh),
    onError: () => {},
  });
}

export function useResetTokenCheck(token: string) {
  return useQuery({
    queryKey: ['auth', 'reset-token', token],
    queryFn: () => apiGet<{ email: string }>(`/auth/reset-password/${token}`).then((r) => r.data),
    retry: false,
    staleTime: Infinity,
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: { token: string; password: string }) =>
      apiSend('post', '/auth/reset-password', input, noRefresh),
    onError: () => {},
  });
}

// ── Profile & security (signed-in) ─────────────────────────────────────────

const setUser = (user: AuthUser) => useAuthStore.getState().setUser(user);

export function useUpdateProfile() {
  return useMutation({
    mutationFn: async (input: { name: string; phone?: string; language: 'en' | 'bn' }) =>
      (await apiSend<AuthUser>('patch', '/auth/profile', input)).data,
    onSuccess: setUser,
    onError: () => {},
  });
}

export function useUploadAvatar() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('avatar', file);
      try {
        return (await api.post<ApiResponse<AuthUser>>('/auth/profile/avatar', form)).data.data;
      } catch (err) {
        throw toApiError(err);
      }
    },
    onSuccess: setUser,
  });
}

export function useRemoveAvatar() {
  return useMutation({
    mutationFn: async () => (await apiSend<AuthUser>('delete', '/auth/profile/avatar')).data,
    onSuccess: setUser,
  });
}

export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      apiSend('post', '/auth/change-password', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] }),
    onError: () => {},
  });
}

export function useTwoFactorSetup() {
  return useMutation({
    mutationFn: async () =>
      (await apiSend<{ qrCode: string; secret: string }>('post', '/auth/2fa/setup')).data,
  });
}

function useRefreshMe() {
  return async () => setUser((await apiGet<AuthUser>('/auth/me')).data);
}

export function useEnableTwoFactor() {
  const refreshMe = useRefreshMe();
  return useMutation({
    mutationFn: (input: { code: string }) => apiSend('post', '/auth/2fa/enable', input),
    onSuccess: refreshMe,
    onError: () => {},
  });
}

export function useDisableTwoFactor() {
  const refreshMe = useRefreshMe();
  return useMutation({
    mutationFn: (input: { password: string; code: string }) => apiSend('post', '/auth/2fa/disable', input),
    onSuccess: refreshMe,
    onError: () => {},
  });
}

export function useSessions() {
  return useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: async () => (await apiGet<Session[]>('/auth/sessions')).data,
  });
}

export function useLoginHistory() {
  return useQuery({
    queryKey: ['auth', 'login-history'],
    queryFn: async () => (await apiGet<LoginAttempt[]>('/auth/login-history')).data,
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiSend('delete', `/auth/sessions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] }),
  });
}

export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiSend('post', '/auth/sessions/revoke-others'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] }),
  });
}
