/** Reject unsafe production configuration before opening a listening socket. */
export function validateProductionConfig(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV !== 'production') return;
  const names = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'ADMIN_JWT_SECRET'] as const;
  const secrets = names.map(name => env[name] || '');
  if (secrets.some(value => value.length < 32 || /(?:change.?me|replace.?me|example|placeholder|development)/i.test(value)) || new Set(secrets).size !== secrets.length) {
    throw new Error('Production JWT secrets must be distinct, non-placeholder values of at least 32 characters');
  }
  if (!env.DATABASE_URL) throw new Error('Production DATABASE_URL is required');
  if (!env.XTREAM_ENCRYPTION_KEY || !/^[a-fA-F0-9]{64}$/.test(env.XTREAM_ENCRYPTION_KEY)) {
    throw new Error('Production XTREAM_ENCRYPTION_KEY must be a 32-byte hexadecimal key');
  }
  if (!env.DEFAULT_TENANT_ID || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env.DEFAULT_TENANT_ID) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(env.DEFAULT_TENANT_ID)) {
    throw new Error('Production DEFAULT_TENANT_ID must be an existing tenant UUID');
  }
}
