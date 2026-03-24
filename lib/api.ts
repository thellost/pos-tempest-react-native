import { addBreadcrumb, captureError, startSpan } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.zidan.id';
const TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return token;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  return startSpan({ name: `${method} ${path}`, op: 'http.client' }, async () => {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const json = await res.json();

      if (!json.success) {
        addBreadcrumb('network', `API error: ${method} ${path}`, {
          status: res.status,
          code: json.error?.code,
          message: json.error?.message,
        }, 'warning');
        throw new ApiError(
          json.error?.code ?? 'UNKNOWN',
          json.error?.message ?? 'Request failed',
        );
      }

      return json.data as T;
    } catch (err) {
      // Only capture unexpected errors (network failures, timeouts) — ApiError is a known business error
      if (!(err instanceof ApiError)) {
        captureError(err, { module: 'api', operation: `${method} ${path}`, level: 'error' });
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  });
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
};
