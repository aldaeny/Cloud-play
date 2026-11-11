import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

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
      // Check if territory is in any of the windows
      const matched = windows.some(w => {
        if (!w.territories) return false;
        // territories is stored as JSON string
        try {
          const territories = JSON.parse(w.territories);
          return territories.includes(territory);
        } catch {
          return w.territories.split(',').map(value => value.trim()).includes(territory);
        }
      });
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
      if (w.territories) {
        try {
          const parsed = JSON.parse(w.territories);
          parsed.forEach((t: string) => territories.add(t));
        } catch {
          territories.add(w.territories);
        }
      }
    }
    return Array.from(territories);
  }
}
