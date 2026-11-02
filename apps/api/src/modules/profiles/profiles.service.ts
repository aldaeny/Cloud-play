import { publicProfileSelect } from '../../common/public-select';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import * as argon2 from 'argon2';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async createProfile(userId: string, data: { name: string; isKid?: boolean; maturityMax?: string; pin?: string }) {
    const pinHash = data.pin ? await argon2.hash(data.pin) : null;
    return this.prisma.profile.create({
      data: {
        userId,
        name: data.name,
        isKid: data.isKid || false,
        maturityMax: data.maturityMax || 'PG-13',
        pinHash,
      },
      select: publicProfileSelect,
    });
  }

  async getProfiles(userId: string) {
    return this.prisma.profile.findMany({ where: { userId }, select: publicProfileSelect });
  }

  async verifyPin(profileId: string, pin: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile?.pinHash) return true;
    return await argon2.verify(profile.pinHash, pin);
  }
}
