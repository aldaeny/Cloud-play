/**
 * Supabase-backed authentication guard for the Hybrid architecture (D1 Option C).
 *
 * Supabase Auth is the only issuer and verifier of end-user identity. This guard
 * turns a verified Supabase session into the `UserRequest` shape that the
 * existing controllers, `@CurrentUser()` decorator and services already expect,
 * so the 13 NestJS modules are reused unchanged.
 *
 * Identity mapping — no migration required:
 *   `AppUser.id` is a UUID and a Supabase user id is a UUID, so the business row
 *   uses the SAME id as `auth.users.id`. There is no second identifier to keep in
 *   sync, no email-based matching, and therefore no schema change.
 *
 *   Matching by email would be unsafe here: the project currently runs with
 *   `mailer_autoconfirm = true`, so Supabase marks signups confirmed without
 *   proving ownership of the address. Linking on email would let anyone who
 *   signs up with someone else's address inherit their business row. We link on
 *   the verified, immutable user id only.
 *
 * This guard RESOLVES an account; it does not create one. Provisioning is a
 * business decision (it needs a tenant) and belongs in an explicit flow, not on
 * an authentication path. An unprovisioned caller gets a distinct, honest error.
 *
 * Additive by design: `JwtAuthGuard` is untouched, so nothing that works today
 * changes behaviour until a controller opts in to this guard.
 */
import { CanActivate, ExecutionContext, Injectable, Logger, HttpException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma.service';
import { UserRequest } from './permissions.decorator';
import { SupabaseAuthService, SupabaseAuthError, supabaseAuthStatus } from './supabase-auth.service';

export type AccountCode = 'ACCOUNT_NOT_PROVISIONED' | 'ACCOUNT_INACTIVE';

/** Attached alongside `request.user` for handlers that need the Supabase identity. */
export interface SupabasePrincipal {
  supabaseUserId: string;
  email: string | null;
}

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly supabaseAuth: SupabaseAuthService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & { user?: UserRequest; supabase?: SupabasePrincipal }
    >();

    const deny=(code:string,status:number)=>{
      if(request.path?.startsWith('/external-playback/'))new Logger('ProtectedPlayback').warn(JSON.stringify({event:'authorization_failure',value:1,status}));
      return new HttpException(code,status);
    };
    const token = SupabaseAuthService.bearer(request.headers['authorization']);
    if (!token) throw deny('SIGN_IN_REQUIRED', 401);

    let identity;
    try {
      identity = await this.supabaseAuth.verifyAccessToken(token);
    } catch (error) {
      if (error instanceof SupabaseAuthError) {
        // 401 for a bad session, 503 when we cannot tell — never a false "allowed".
        throw deny(error.code, supabaseAuthStatus(error.code));
      }
      throw deny('AUTH_UNAVAILABLE', 503);
    }

    // The verified Supabase id IS the business primary key.
    const account = await this.prisma.appUser.findUnique({
      where: { id: identity.id },
      select: { id: true, status: true, tenantId: true, profiles: { select: { id: true } } },
    });

    if (!account) throw new HttpException('ACCOUNT_NOT_PROVISIONED' satisfies AccountCode, 403);
    if (account.status !== 'active') throw new HttpException('ACCOUNT_INACTIVE' satisfies AccountCode, 403);

    request.user = {
      id: account.id,
      tenantId: account.tenantId,
      profiles: account.profiles.map(profile => profile.id),
    };
    request.supabase = { supabaseUserId: identity.id, email: identity.email };

    return true;
  }
}
