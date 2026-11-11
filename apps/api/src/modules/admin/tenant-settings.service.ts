import { Injectable, BadRequestException } from '@nestjs/common';
import type { Plan } from '@prisma/client';
import { PrismaService } from '../../prisma.service';

export const INTERNAL_TIERS = Object.freeze({
  Starter: { maxStreams: 1, maxDevices: 2 },
  Professional: { maxStreams: 3, maxDevices: 5 },
  Business: { maxStreams: 5, maxDevices: 10 },
});
const COLORS = ['brandDark', 'brandCard', 'cyanGlow', 'magentaGlow', 'violetGlow', 'amberGlow'] as const;

@Injectable()
export class TenantSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  getBranding(tenantId: string) {
    return this.prisma.tenantBranding.findUnique({ where: { tenantId } });
  }

  async saveBranding(tenantId: string, actorId: string, input: unknown) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Invalid branding');
    const body = input as Record<string, unknown>;
    if (Object.keys(body).some(key => !['displayName', 'logoUrl', ...COLORS].includes(key))) throw new BadRequestException('Unknown branding field');
    const data: Record<string, string | null> = {};
    if (body.displayName !== undefined) {
      if (typeof body.displayName !== 'string' || !body.displayName.trim() || body.displayName.length > 80 || Array.from(body.displayName).some(char => char.charCodeAt(0) < 32)) throw new BadRequestException('Invalid display name');
      data.displayName = body.displayName.trim();
    }
    for (const key of COLORS) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(body[key])) throw new BadRequestException('Colors must be #RRGGBB');
        data[key] = body[key] as string;
      }
    }
    if (body.logoUrl !== undefined) {
      // No arbitrary external tracking, SVG scripts, data URLs or backend fetch.
      if (body.logoUrl !== null && (typeof body.logoUrl !== 'string' || !/^\/brand-assets\/[a-zA-Z0-9_-]+\.(png|webp|jpg)$/.test(body.logoUrl))) throw new BadRequestException('Logo must be a local raster brand asset');
      data.logoUrl = body.logoUrl as string | null;
    }
    return this.prisma.$transaction(async tx => {
      const branding = await tx.tenantBranding.upsert({ where: { tenantId }, create: { tenantId, ...data }, update: data });
      await tx.auditLog.create({ data: { tenantId, actorId, action: 'branding.updated', entity: 'TenantBranding', entityId: branding.id, diff: { fields: Object.keys(data) } } });
      return branding;
    });
  }

  async installInternalPlans(tenantId: string, actorId: string) {
    // Explicit, idempotent non-financial catalog. Never edits existing priced plans.
    return this.prisma.$transaction(async tx => {
      const plans: Plan[] = [];
      for (const [name, limits] of Object.entries(INTERNAL_TIERS)) {
        plans.push(await tx.plan.upsert({ where: { tenantId_code: { tenantId, code: `internal-${name.toLowerCase()}` } },
          update: {}, create: { tenantId, code: `internal-${name.toLowerCase()}`, interval: 'manual', priceCents: 0, currency: 'USD', ...limits } }));
      }
      await tx.auditLog.create({ data: { tenantId, actorId, action: 'internal-plans.installed', entity: 'Plan', diff: { financial: false } } });
      return { financial: false, plans };
    });
  }
}
