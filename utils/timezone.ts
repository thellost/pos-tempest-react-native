import { Config } from '@/constants/config';

/**
 * App-wide timezone store.
 *
 * Initialised from Config.TIMEZONE (the branch default) and overridden at
 * runtime by useAppTimezone() once branch data loads from settings.
 */

let _appTimezone: string = Config.TIMEZONE;

/** Returns the configured app timezone (e.g. "Asia/Jakarta"). */
export function getAppTimezone(): string {
  return _appTimezone;
}

/** Called from useAppTimezone() when branch data loads. */
export function setAppTimezone(tz: string): void {
  _appTimezone = tz;
}
