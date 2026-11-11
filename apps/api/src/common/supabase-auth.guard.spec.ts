import { ExecutionContext, HttpException } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { SupabaseAuthService, SupabaseAuthError } from './supabase-auth.service';

const USER_ID = 'dcf31e85-dd5b-4972-91aa-b11ba343508c';
const TENANT_ID = '12345678-1234-4234-8234-123456789abc';

function contextWith(headers: Record<string, string | undefined>) {
  const request: Record<string, unknown> = { headers };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('SupabaseAuthGuard', () => {
  let auth: { verifyAccessToken: jest.Mock };
  let prisma: { tenant: { findUnique: jest.Mock }; appUser: { findUnique: jest.Mock } };
  let guard: SupabaseAuthGuard;

  const activeAccount = { id: USER_ID, status: 'active', tenantId: TENANT_ID, profiles: [{ id: 'p1' }, { id: 'p2' }] };

  beforeEach(() => {
    auth = { verifyAccessToken: jest.fn().mockResolvedValue({ id: USER_ID, email: 'owner@example.com', emailConfirmed: true }) };
    prisma = { tenant: { findUnique: jest.fn().mockResolvedValue({ licenseEnforced: false }) }, appUser: { findUnique: jest.fn().mockResolvedValue(activeAccount) } };
    guard = new SupabaseAuthGuard(auth as unknown as SupabaseAuthService, prisma as never);
  });

  it('maps a verified Supabase session onto the existing UserRequest shape', async () => {
    const { context, request } = contextWith({ authorization: 'Bearer aaa.bbb.ccc' });
    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(auth.verifyAccessToken).toHaveBeenCalledWith('aaa.bbb.ccc');
    expect(request.user).toEqual({ id: USER_ID, tenantId: TENANT_ID, profiles: ['p1', 'p2'] });
    expect(request.supabase).toEqual({ supabaseUserId: USER_ID, email: 'owner@example.com' });
  });

  it('looks the account up by the verified Supabase id, never by email', async () => {
    const { context } = contextWith({ authorization: 'Bearer aaa.bbb.ccc' });
    await guard.canActivate(context);
    expect(prisma.appUser.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: USER_ID } }),
    );
    const arg = prisma.appUser.findUnique.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where).not.toHaveProperty('email');
  });

  it('rejects a request with no bearer token before touching auth or the database', async () => {
    const { context } = contextWith({});
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401, message: 'SIGN_IN_REQUIRED' });
    expect(auth.verifyAccessToken).not.toHaveBeenCalled();
    expect(prisma.appUser.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a malformed authorization header', async () => {
    const { context } = contextWith({ authorization: 'Basic zzz' });
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401 });
    expect(auth.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid or expired session', async () => {
    auth.verifyAccessToken.mockRejectedValue(new SupabaseAuthError('TOKEN_INVALID'));
    const { context, request } = contextWith({ authorization: 'Bearer aaa.bbb.ccc' });
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401, message: 'TOKEN_INVALID' });
    expect(request.user).toBeUndefined();
    expect(prisma.appUser.findUnique).not.toHaveBeenCalled();
  });

  it.each(['AUTH_NOT_CONFIGURED', 'AUTH_UNAVAILABLE'] as const)(
    'returns 503 for %s rather than pretending the user is signed out',
    async code => {
      auth.verifyAccessToken.mockRejectedValue(new SupabaseAuthError(code));
      const { context } = contextWith({ authorization: 'Bearer aaa.bbb.ccc' });
      await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 503, message: code });
      expect(prisma.appUser.findUnique).not.toHaveBeenCalled();
    },
  );

  it('fails closed on an unexpected verifier error', async () => {
    auth.verifyAccessToken.mockRejectedValue(new Error('unexpected'));
    const { context } = contextWith({ authorization: 'Bearer aaa.bbb.ccc' });
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 503, message: 'AUTH_UNAVAILABLE' });
  });

  it('refuses a verified identity that has no business account, without creating one', async () => {
    prisma.appUser.findUnique.mockResolvedValue(null);
    const { context, request } = contextWith({ authorization: 'Bearer aaa.bbb.ccc' });
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 403, message: 'ACCOUNT_NOT_PROVISIONED' });
    expect(request.user).toBeUndefined();
    expect(prisma.appUser.findUnique).toHaveBeenCalledTimes(1);
  });

  it.each(['suspended', 'deleted', 'pending'])('refuses an inactive account (%s)', async status => {
    prisma.appUser.findUnique.mockResolvedValue({ ...activeAccount, status });
    const { context, request } = contextWith({ authorization: 'Bearer aaa.bbb.ccc' });
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 403, message: 'ACCOUNT_INACTIVE' });
    expect(request.user).toBeUndefined();
  });

  it('handles an account with no profiles', async () => {
    prisma.appUser.findUnique.mockResolvedValue({ ...activeAccount, profiles: [] });
    const { context, request } = contextWith({ authorization: 'Bearer aaa.bbb.ccc' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect((request.user as { profiles: string[] }).profiles).toEqual([]);
  });

  it('propagates a database failure instead of granting access', async () => {
    prisma.appUser.findUnique.mockRejectedValue(new Error('db down'));
    const { context, request } = contextWith({ authorization: 'Bearer aaa.bbb.ccc' });
    await expect(guard.canActivate(context)).rejects.toThrow('db down');
    expect(request.user).toBeUndefined();
  });

  it('produces HttpException instances Nest can serialize', async () => {
    const { context } = contextWith({});
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(HttpException);
  });
});
