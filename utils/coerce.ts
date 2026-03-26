export function toInt(value: string | number): number {
  return typeof value === 'string' ? parseInt(value, 10) : value;
}

export function toIntOrNull(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === 'string' ? parseInt(value, 10) : value;
}

/** Coerces a DB value (string | number | null | undefined) to a float, defaulting to 0. */
export function toFloat(value: number | string | null | undefined): number {
  if (value == null) return 0;
  return typeof value === 'string' ? parseFloat(value) || 0 : value;
}
