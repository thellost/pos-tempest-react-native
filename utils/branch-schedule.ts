export const TZ_FALLBACK = 'Asia/Jakarta';

function resolveTz(tz: string | null | undefined): string {
  return tz && tz.length > 0 ? tz : TZ_FALLBACK;
}

/** "YYYY-MM-DD" in the branch timezone */
export function localDateInTz(tz: string | null | undefined, when: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: resolveTz(tz),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(when);
}

/** "HH:MM" (24h) in the branch timezone */
export function localTimeInTz(tz: string | null | undefined, when: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: resolveTz(tz),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(when);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Is `when` (in `tz`) inside the operating window [opening, closing)?
 * Handles cross-midnight windows where closing < opening (e.g. 18:00–02:00).
 * Returns false when opening == closing (treated as closed all day).
 */
export function isWithinOperatingWindow(
  opening: string,
  closing: string,
  tz: string | null | undefined = TZ_FALLBACK,
  when: Date = new Date(),
): boolean {
  const nowMin = toMinutes(localTimeInTz(tz, when));
  const openMin = toMinutes(opening);
  const closeMin = toMinutes(closing);
  if (openMin === closeMin) return false;
  if (openMin < closeMin) {
    return nowMin >= openMin && nowMin < closeMin;
  }
  return nowMin >= openMin || nowMin < closeMin;
}

/**
 * "Operating day" key — the date the shift was conceptually opened on,
 * in branch tz. For cross-midnight branches, an event at 01:00 still belongs
 * to the previous calendar day's shift.
 */
export function operatingDayKey(
  opening: string,
  closing: string,
  tz: string | null | undefined,
  when: Date = new Date(),
): string {
  const resolvedTz = resolveTz(tz);
  const nowMin = toMinutes(localTimeInTz(resolvedTz, when));
  const openMin = toMinutes(opening);
  const closeMin = toMinutes(closing);
  if (openMin <= closeMin) return localDateInTz(resolvedTz, when);
  if (nowMin < closeMin) {
    const yest = new Date(when.getTime() - 24 * 60 * 60 * 1000);
    return localDateInTz(resolvedTz, yest);
  }
  return localDateInTz(resolvedTz, when);
}
