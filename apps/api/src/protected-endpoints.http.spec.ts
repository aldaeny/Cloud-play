import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module';
import { PrismaService } from './prisma.service';
import { SupabaseAuthService, SupabaseAuthError } from './common/supabase-auth.service';

// Source inventory is a CommonJS CLI shared with the documentation generator.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { routes } = require('../scripts/auth-matrix.cjs') as {
  routes: Array<{ module: string; method: string; endpoint: string; guards: string }>;
};
const protectedRoutes = routes.filter(route => !route.guards.startsWith('NONE'));
const userRoutes = protectedRoutes.filter(route => route.guards.includes('JwtAuthGuard') || route.guards.includes('SupabaseAuthGuard'));
const id = '11111111-1111-4111-8111-111111111111';

/** Every declared protected route gets actual HTTP rejection checks. These are
 * NOT substitutes for route-specific authorized ownership/tenant tests. */
describe('protected endpoint HTTP denial matrix', () => {
  let app: INestApplication;
  const previous = process.env.API_END_USER_AUTHORITY;
  const db = { appUser: { findUnique: jest.fn() }, staffUser: { findUnique: jest.fn() } };
  const verifyAccessToken = jest.fn();
  beforeAll(async () => {
    process.env.API_END_USER_AUTHORITY = 'supabase';
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(db)
      .overrideProvider(SupabaseAuthService).useValue({ verifyAccessToken }).compile();
    app = mod.createNestApplication({ logger: false }); await app.init();
  });
  beforeEach(() => { jest.clearAllMocks(); });
  afterAll(async () => {
    await app?.close();
    if (previous === undefined) delete process.env.API_END_USER_AUTHORITY; else process.env.API_END_USER_AUTHORITY = previous;
  });
  async function hit(route: typeof protectedRoutes[number], token?: string) {
    const url = route.endpoint.replace(/:[^/]+/g, id);
    // supertest verbs below are selected exclusively from parsed source metadata.
    const agent = request(app.getHttpServer());
    const call = route.method === 'GET' ? agent.get(url) : route.method === 'POST' ? agent.post(url) :
      route.method === 'PUT' ? agent.put(url) : route.method === 'PATCH' ? agent.patch(url) : agent.delete(url);
    return token ? call.set('Authorization', `Bearer ${token}`).send({ userId: id, tenantId: id, roles: ['admin'] }) : call;
  }
  it.each(protectedRoutes.map(route => [route.method, route.endpoint, route] as const))('%s %s rejects missing credentials before DB access', async (_method, _path, route) => {
    expect((await hit(route)).status).toBe(401);
    expect(db.appUser.findUnique).not.toHaveBeenCalled(); expect(db.staffUser.findUnique).not.toHaveBeenCalled();
  });
  it.each(userRoutes.map(route => [route.method, route.endpoint, route] as const))('%s %s rejects an invalid Supabase session without legacy fallback', async (_method, _path, route) => {
    verifyAccessToken.mockRejectedValue(new SupabaseAuthError('TOKEN_INVALID'));
    expect((await hit(route, 'fixture.invalid.jwt')).status).toBe(401);
    expect(db.appUser.findUnique).not.toHaveBeenCalled();
  });
  it.each(userRoutes.map(route => [route.method, route.endpoint, route] as const))('%s %s rejects a disabled account before business operations', async (_method, _path, route) => {
    verifyAccessToken.mockResolvedValue({ id, email: null, emailConfirmed: false });
    db.appUser.findUnique.mockResolvedValue({ id, status: 'disabled', tenantId: id, profiles: [] });
    expect((await hit(route, 'fixture.valid.jwt')).status).toBe(403);
    expect(db.appUser.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id } }));
  });
});
