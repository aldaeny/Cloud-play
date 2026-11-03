// JWT TTL environment values are defined in seconds, never millisecond strings.
export function jwtTtlSeconds(name: 'JWT_ACCESS_TTL' | 'JWT_REFRESH_TTL', fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be a positive integer in seconds`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer in seconds`);
  return value;
}
