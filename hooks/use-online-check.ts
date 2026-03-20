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
    setIsChecking(true);
    try {
      const res = await fetch(`${API_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      setIsOnline(res.ok);
    } catch {
      setIsOnline(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  return { isOnline, isChecking, checkOnline };
}
