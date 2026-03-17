export function toInt(value: string | number): number {
  return typeof value === 'string' ? parseInt(value, 10) : value;
}

export function toIntOrNull(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === 'string' ? parseInt(value, 10) : value;
}
