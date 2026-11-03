import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AdminPrincipal } from './admin-jwt.guard';

export interface UserRequest {
  id: string;
  tenantId: string;
  profiles: string[];
}

/**
 * Decorator to get the authenticated user from the request.
 * Usage: @CurrentUser() user: UserRequest
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserRequest => {
    const request = ctx.switchToHttp().getRequest<Request & { user: UserRequest }>();
    return request.user;
  },
);

/**
 * Decorator to get admin user from the request.
 */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request & { admin: AdminPrincipal }>();
    return request.admin;
  },
);

/**
 * Metadata key for permissions requirement.
 */
export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to require specific permissions on an endpoint.
 * Usage: @RequirePermissions('titles:create', 'titles:edit')
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
