import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

// Current writes use a JSON array. Preserve a legacy single country code, but
// fail closed on malformed lists, JSON strings, objects and partial matches.
function parseTerritories(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(value => typeof value === 'string' && /^[A-Z]{2}$/.test(value))
      ? parsed : [];
  } catch {
    return /^[A-Z]{2}$/.test(raw) ? [raw] : [];
  }
}

@Injectable()
export class RightsService {
  constructor(private readonly prisma: PrismaService) {}

  async checkRights(titleId: string, territory?: string, now = new Date()) {
    const windows = await this.prisma.rightsWindow.findMany({
      where: {
        titleId,
        endsAt: { gte: now },
        startsAt: { lte: now },
      },
    });

    if (windows.length === 0) {
      throw new ForbiddenException('RIGHTS_OR_RATING', { cause: new Error('403') });
    }

    if (territory && windows.length > 0) {
      // Only complete country codes can grant rights. A substring search on
      // malformed JSON or a JSON string can accidentally authorize a country.
      const matched = windows.some(w => parseTerritories(w.territories).includes(territory));
      if (!matched) {
        throw new ForbiddenException('RIGHTS_OR_RATING', { cause: new Error('403') });
      }
    }

    return windows;
  }

  async getTerritories(titleId: string) {
    const windows = await this.prisma.rightsWindow.findMany({
      where: { titleId },
    });
    const territories = new Set<string>();
    for (const w of windows) {
      for (const territory of parseTerritories(w.territories)) territories.add(territory);
    }
    return Array.from(territories);
  }
}
