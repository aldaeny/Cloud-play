import { ExecutionContext, HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { AdminJwtGuard } from './admin-jwt.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaService } from '../prisma.service';

/** Real JWT cryptography/expiry and guards. Database records are isolated fixtures. */
describe('retained legacy guard security boundaries', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const tenantId = '22222222-2222-4222-8222-222222222222';
  const forgedTenant = '33333333-3333-4333-8333-333333333333';
  const jwt = new JwtService();
  const db = { tenant: { findUnique: jest.fn().mockResolvedValue({ licenseEnforced: false }) }, appUser: { findUnique: jest.fn() }, staffUser: { findUnique: jest.fn() } };
  const reflector = { getAllAndOverride: jest.fn() };
  const previous = { access: process.env.JWT_ACCESS_SECRET, admin: process.env.ADMIN_JWT_SECRET };
  const userSecret = 'test-only-user-key-not-a-production-secret';
  const adminSecret = 'test-only-staff-key-not-a-production-secret';
  let userGuard: JwtAuthGuard;
  let adminGuard: AdminJwtGuard;
  function context(token?: string) {
    const req = { headers: token ? { authorization: `Bearer ${token}` } : {}, user: undefined, admin: undefined };
    return { req, ctx: { switchToHttp: () => ({ getRequest: () => req }), getHandler: () => context,
      getClass: () => AdminJwtGuard } as unknown as ExecutionContext };
  }
  function sign(admin: boolean, payload: object = {}, expiresIn = 60) {
    return jwt.sign({ sub: id, tokenType: admin ? 'admin' : 'user', tenantId: forgedTenant,
      permissions: ['xtream:manage'], profiles: ['forged-profile'], ...payload },
    { secret: admin ? adminSecret : userSecret, expiresIn });
  }
  async function denied(guard: AdminJwtGuard | JwtAuthGuard, token: string | undefined, status: number) {
    try { await guard.canActivate(context(token).ctx); throw new Error('unexpected authorization'); }
    catch (error) { expect(error).toBeInstanceOf(HttpException); expect((error as HttpException).getStatus()).toBe(status); }
  }
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = userSecret;
    process.env.ADMIN_JWT_SECRET = adminSecret;
    db.appUser.findUnique.mockResolvedValue({ id, status: 'active', tenantId, profiles: [{ id: 'real-profile' }] });
    db.staffUser.findUnique.mockResolvedValue({ id, tenantId, roleId: id,
      role: { tenantId, permissions: '["xtream:manage"]' } });
    reflector.getAllAndOverride.mockReturnValue(['xtream:manage']);
    userGuard = new JwtAuthGuard(jwt, db as unknown as PrismaService);
    adminGuard = new AdminJwtGuard(jwt, db as unknown as PrismaService, reflector as unknown as Reflector);
  });
  afterAll(() => {
    if (previous.access === undefined) delete process.env.JWT_ACCESS_SECRET; else process.env.JWT_ACCESS_SECRET = previous.access;
    if (previous.admin === undefined) delete process.env.ADMIN_JWT_SECRET; else process.env.ADMIN_JWT_SECRET = previous.admin;
  });
  it.each([false, true])('rejects missing token (admin=%s)', async admin => {
    await denied(admin ? adminGuard : userGuard, undefined, 401);
    expect(db.appUser.findUnique).not.toHaveBeenCalled(); expect(db.staffUser.findUnique).not.toHaveBeenCalled();
  });
  it.each([false, true])('rejects expired token (admin=%s)', async admin => {
    await denied(admin ? adminGuard : userGuard, sign(admin, {}, -1), 401);
    expect(db.appUser.findUnique).not.toHaveBeenCalled(); expect(db.staffUser.findUnique).not.toHaveBeenCalled();
  });
  it.each([false, true])('rejects malformed subject without querying (admin=%s)', async admin => {
    await denied(admin ? adminGuard : userGuard, sign(admin, { sub: { id } }), 401);
    expect(db.appUser.findUnique).not.toHaveBeenCalled(); expect(db.staffUser.findUnique).not.toHaveBeenCalled();
  });
  it('does not accept a user token as an admin token', async () => { await denied(adminGuard, sign(false), 401); });
  it('does not accept an admin token as a user token', async () => { await denied(userGuard, sign(true), 401); });
  it('resolves tenant and profiles from database, ignoring forged claims', async () => {
    const { req, ctx } = context(sign(false));
    expect(await userGuard.canActivate(ctx)).toBe(true);
    expect(req.user).toEqual({ id, tenantId, profiles: ['real-profile'] });
  });
  it('rejects disabled user even with an otherwise valid token', async () => {
    db.appUser.findUnique.mockResolvedValue({ id, status: 'disabled' });
    await denied(userGuard, sign(false), 401);
  });
  it('rejects deleted staff', async () => {
    db.staffUser.findUnique.mockResolvedValue(null); await denied(adminGuard, sign(true), 401);
  });
  it('rejects role from a different tenant', async () => {
    db.staffUser.findUnique.mockResolvedValue({ id, tenantId, role: { tenantId: forgedTenant, permissions: '["xtream:manage"]' } });
    await denied(adminGuard, sign(true), 401);
  });
  it('does not trust permissions embedded in the token', async () => {
    db.staffUser.findUnique.mockResolvedValue({ id, tenantId, role: { tenantId, permissions: '[]' } });
    await denied(adminGuard, sign(true), 403);
  });
  it('takes admin tenant and permissions from the current database role', async () => {
    const { req, ctx } = context(sign(true));
    expect(await adminGuard.canActivate(ctx)).toBe(true);
    expect(req.admin).toEqual({ id, tenantId, roleId: id, permissions: ['xtream:manage'] });
  });
});
