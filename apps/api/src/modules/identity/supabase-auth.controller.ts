import { Controller, Post, Body, HttpStatus, Res, HttpCode } from '@nestjs/common';
import { Response } from 'express';
import { SupabaseAuthService } from '../../common/supabase-auth.service';
import { PrismaService } from '../../prisma.service';
import * as crypto from 'crypto';

@Controller('hybrid/auth')
export class SupabaseAuthController {
  constructor(
    private readonly supabaseAuth: SupabaseAuthService,
    private readonly prisma: PrismaService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body('refresh_token') refreshToken: string, @Res() res: Response) {
    // In Hybrid mode, Supabase handles session invalidation client-side.
    // Server-side: revoke the refresh token in our database if it exists.
    if (refreshToken) {
      try {
        const tokenHash = this.hashToken(refreshToken);
        await this.prisma.refreshToken.update({
          where: { tokenHash },
          data: { revokedAt: new Date() },
        });
      } catch {
        // Token not found or already revoked - idempotent
      }
    }
    return res.json({ success: true, message: 'Logged out' });
  }

  @Post('revoke-all')
  @HttpCode(HttpStatus.OK)
  async revokeAll(@Body('user_id') userId: string, @Res() res: Response) {
    // Revoke all refresh tokens for a user (server-side cleanup)
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return res.json({ success: true, message: 'All user tokens revoked' });
  }

  @Post('revoke-session')
  @HttpCode(HttpStatus.OK)
  async revokeSession(
    @Body('user_id') userId: string,
    @Body('session_id') sessionId: string,
    @Res() res: Response,
  ) {
    // Revoke a specific session by its ID (maps to refresh token)
    // In practice, the session_id from Supabase auth.sessions can be used
    // to identify which refresh token to revoke.
    // For now, revoke all as a safe fallback.
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return res.json({ success: true, message: 'Session revoked' });
  }
}