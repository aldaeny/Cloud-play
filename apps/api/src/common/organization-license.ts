import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import type { PrismaService } from '../prisma.service';
/** DB-resolved tenant only; clients cannot activate or change organization limits. */
export async function requireOrganization(prisma: PrismaService, tenantId: string): Promise<void> {
  const org = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { licenseEnforced: true, licenseStatus: true, licenseExpiresAt: true } });
  if (!org) throw new ServiceUnavailableException('ORGANIZATION_UNAVAILABLE');
  if (org.licenseEnforced && (org.licenseStatus !== 'active' || !org.licenseExpiresAt || org.licenseExpiresAt <= new Date())) throw new ForbiddenException('ORGANIZATION_LICENSE_REQUIRED');
}
