import { useCallback, useState } from 'react';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

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
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timer);
      setIsOnline(res.ok);
    } catch {
      setIsOnline(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  return { isOnline, isChecking, checkOnline };
}
