import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
@Controller('branding')
export class PublicBrandingController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('public')
  async branding() {
    // Explicit operator site binding, never Host/query/body supplied tenant IDs.
    const tenantId = process.env.PUBLIC_BRANDING_TENANT_ID;
    if (!tenantId || !/^[a-f0-9-]{36}$/i.test(tenantId)) throw new ServiceUnavailableException('PUBLIC_BRANDING_NOT_CONFIGURED');
    return this.prisma.tenantBranding.findUnique({ where: { tenantId }, select: {
      displayName: true, logoUrl: true, brandDark: true, brandCard: true,
      cyanGlow: true, magentaGlow: true, violetGlow: true, amberGlow: true,
    } });
  }
}
