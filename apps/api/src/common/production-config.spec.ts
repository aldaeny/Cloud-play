import { validateProductionConfig } from './production-config';
describe('production configuration', () => {
  const good: NodeJS.ProcessEnv = { NODE_ENV: 'production', JWT_ACCESS_SECRET:'a'.repeat(32), JWT_REFRESH_SECRET:'b'.repeat(32), ADMIN_JWT_SECRET:'c'.repeat(32), DATABASE_URL:'postgresql://localhost/db', DEFAULT_TENANT_ID:'12345678-1234-4234-8234-123456789abc', XTREAM_ENCRYPTION_KEY:'d'.repeat(64) };
  it('fails closed for missing, reused, short or sample signing secrets', () => {
    for (const value of ['', 'short', 'replace-me-'.repeat(4), 'b'.repeat(32)]) expect(() => validateProductionConfig({ ...good, JWT_ACCESS_SECRET:value })).toThrow();
  });
  it('requires a database and a non-zero tenant in production', () => {
    expect(() => validateProductionConfig({ ...good, DATABASE_URL:'' })).toThrow();
    expect(() => validateProductionConfig({ ...good, XTREAM_ENCRYPTION_KEY:'not-a-valid-key' })).toThrow();
    expect(() => validateProductionConfig({ ...good, DEFAULT_TENANT_ID:'00000000-0000-0000-0000-000000000000' })).toThrow();
    expect(() => validateProductionConfig(good)).not.toThrow();
    expect(() => validateProductionConfig({ NODE_ENV:'test' })).not.toThrow();
  });
});
