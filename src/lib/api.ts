import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import type { ApiErrorBody, ApiResponse, AuthUser } from '@/types';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  const { language, activeBranchId } = useSettingsStore.getState();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  if (activeBranchId) config.headers['X-Branch-Id'] = activeBranchId;
  config.headers['Accept-Language'] = language;
  return config;
});

/** Normalised error thrown by API helpers and surfaced by TanStack Query. */
export class ApiError extends Error {
  status: number;
  errors?: ApiErrorBody['errors'];

  constructor(message: string, status: number, errors?: ApiErrorBody['errors']) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof AxiosError) {
    const body = err.response?.data as Partial<ApiErrorBody> | undefined;
    return new ApiError(body?.message || err.message, err.response?.status ?? 0, body?.errors);
  }
  return new ApiError(err instanceof Error ? err.message : 'Unknown error', 0);
}

// ── Silent refresh ─────────────────────────────────────────────────────────

interface SessionPayload {
  accessToken: string;
  user: AuthUser;
}

let refreshPromise: Promise<SessionPayload> | null = null;

/**
 * Exchange the httpOnly refresh cookie for a new access token. Concurrent callers
 * share one request, so a burst of 401s triggers a single rotation.
 */
export function refreshSession(): Promise<SessionPayload> {
  refreshPromise ??= api
    .post<ApiResponse<SessionPayload>>('/auth/refresh', undefined, { skipAuthRefresh: true })
    .then((res) => {
      const { accessToken, user } = res.data.data;
      useAuthStore.getState().setSession(user, accessToken);
      return res.data.data;
    })
    .catch((err) => {
      const error = toApiError(err);
      // Offline (no response): keep a signed-in user signed in — the POS keeps selling and retries later.
      if (error.status !== 0 || !useAuthStore.getState().user) useAuthStore.getState().clear();
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Don't try a silent refresh when this request returns 401 (auth endpoints). */
    skipAuthRefresh?: boolean;
  }
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as RetriableConfig | undefined;
  const hadSession = Boolean(useAuthStore.getState().accessToken);

  if (error.response?.status === 401 && config && !config.skipAuthRefresh && !config._retried && hadSession) {
    config._retried = true;
    try {
      const { accessToken } = await refreshSession();
      config.headers.Authorization = `Bearer ${accessToken}`;
      return api.request(config);
    } catch {
      // refreshSession() cleared the store → ProtectedRoute redirects to /login.
    }
  }
  return Promise.reject(error);
});

// ── Typed helpers ──────────────────────────────────────────────────────────

/** GET returning the full envelope (data + meta). */
export async function apiGet<T>(url: string, params?: object) {
  try {
    const res = await api.get<ApiResponse<T>>(url, { params });
    return res.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function apiSend<T>(
  method: 'post' | 'put' | 'patch' | 'delete',
  url: string,
  body?: unknown,
  config?: { skipAuthRefresh?: boolean; headers?: Record<string, string> },
) {
  try {
    const res = await api.request<ApiResponse<T>>({ method, url, data: body, ...config });
    return res.data;
  } catch (err) {
    throw toApiError(err);
  }
}

/** GET a list endpoint and return { rows, meta } (meta always present). */
export async function apiList<T>(url: string, params?: object) {
  const res = await apiGet<T[]>(url, params);
  return {
    rows: res.data,
    meta: res.meta ?? { page: 1, limit: res.data.length, total: res.data.length, totalPages: 1 },
  };
}

/** Walk every page of a list endpoint (server max is 100 per page) — used by "export all". */
export async function fetchAllPages<T>(url: string, params: object = {}, maxRows = 10_000) {
  const rows: T[] = [];
  for (let page = 1; rows.length < maxRows; page += 1) {
    const { rows: batch, meta } = await apiList<T>(url, { ...params, page, limit: 100 });
    rows.push(...batch);
    if (page >= meta.totalPages || batch.length === 0) break;
  }
  return rows;
}

/** Absolute URL for files served by the API (e.g. "/uploads/avatars/x.png"). */
export function assetUrl(path: string | null | undefined) {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  const origin = import.meta.env.VITE_ASSET_URL ?? '';
  return `${origin}${path}`;
}
