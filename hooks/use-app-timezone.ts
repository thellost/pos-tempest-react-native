import { useEffect } from 'react';
import { useDevice } from './use-device';
import { setAppTimezone } from '@/utils/timezone';

/**
 * Reads the branch timezone from device registration settings and writes it
 * into the app-wide timezone store. Call this once in the app layout.
 */
export function useAppTimezone() {
  const { registration } = useDevice();

  useEffect(() => {
    const tz = registration?.branch?.timezone;
    if (tz) setAppTimezone(tz);
  }, [registration?.branch?.timezone]);
}
