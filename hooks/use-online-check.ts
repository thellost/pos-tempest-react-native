import { useCallback, useState } from 'react';

import { addBreadcrumb, startSpan } from '@/lib/sentry';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.zidan.id';

/**
 * Checks whether the backend API is reachable by hitting the /health endpoint.
 * isOnline is null until the first check completes.
 */
export function useOnlineCheck() {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkOnline = useCallback(async () => {
    const url = `${API_URL}/health`;
    setIsChecking(true);
    try {
      await startSpan({ name: 'GET /health', op: 'http.client' }, async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timer);
        setIsOnline(res.ok);
        addBreadcrumb('network', res.ok ? 'API health check passed' : 'API health check failed', { url, status: res.status }, res.ok ? 'info' : 'warning');
      });
    } catch {
      setIsOnline(false);
      addBreadcrumb('network', 'API health check unreachable', { url }, 'warning');
    } finally {
      setIsChecking(false);
    }
  }, []);

  return { isOnline, isChecking, checkOnline };
}
