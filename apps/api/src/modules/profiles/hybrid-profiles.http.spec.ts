import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma.service';
import { SupabaseAuthService, SupabaseAuthError } from '../../common/supabase-auth.service';
import { publicProfileSelect } from '../../common/public-select';

/** Real HTTP/guard/service composition; auth authority and database are fixtures. */
describe('Supabase-authenticated profiles HTTP contract', () => {
  let app: INestApplication;
  const id = '11111111-1111-4111-8111-111111111111';
  const otherId = '22222222-2222-4222-8222-222222222222';
  const db = { tenant: { findUnique: jest.fn().mockResolvedValue({ licenseEnforced: false }) }, appUser: { findUnique: jest.fn() }, profile: { findMany: jest.fn() } };
  const verifyAccessToken = jest.fn();
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(db)
      .overrideProvider(SupabaseAuthService).useValue({ verifyAccessToken })
      .compile();
    app = mod.createNestApplication();
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    verifyAccessToken.mockResolvedValue({ id, email: null, emailConfirmed: false });
    db.appUser.findUnique.mockResolvedValue({ id, status: 'active', tenantId: otherId, profiles: [] });
    db.profile.findMany.mockResolvedValue([{ id: otherId, userId: id, name: 'Fixture' }]);
  });
  afterAll(async () => { await app?.close(); });
  const get = () => request(app.getHttpServer()).get('/hybrid/profiles');

  it('rejects missing session before accessing the database', async () => {
    await get().expect(401);
    expect(db.appUser.findUnique).not.toHaveBeenCalled();
  });
  it.each(['TOKEN_INVALID', 'AUTH_UNAVAILABLE'] as const)('fails closed on %s', async code => {
    verifyAccessToken.mockRejectedValue(new SupabaseAuthError(code));
    await get().set('Authorization', 'Bearer a.b.c').expect(code === 'TOKEN_INVALID' ? 401 : 503);
    expect(db.appUser.findUnique).not.toHaveBeenCalled();
  });
  it('rejects unprovisioned identity without creating an account', async () => {
    db.appUser.findUnique.mockResolvedValue(null);
    await get().set('Authorization', 'Bearer a.b.c').expect(403);
    expect(db.profile.findMany).not.toHaveBeenCalled();
  });
  it('rejects inactive account', async () => {
    db.appUser.findUnique.mockResolvedValue({ id, status: 'suspended', profiles: [] });
    await get().set('Authorization', 'Bearer a.b.c').expect(403);
    expect(db.profile.findMany).not.toHaveBeenCalled();
  });
  it('ignores forged owner/tenant parameters and uses the public response allowlist', async () => {
    const response = await get().query({ userId: otherId, tenantId: id })
      .set('Authorization', 'Bearer a.b.c').expect(200);
    expect(db.profile.findMany).toHaveBeenCalledWith({ where: { userId: id }, select: publicProfileSelect });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({ data: [{ id: otherId, userId: id, name: 'Fixture' }] });
    expect(publicProfileSelect).not.toHaveProperty('pinHash');
  });
});
