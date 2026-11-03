import { Prisma } from '@prisma/client';
import { publicProfileSelect } from '../../common/public-select';
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser, type UserRequest } from '../../common/permissions.decorator';
import { CreateProfileDto, UpdateProfileDto, VerifyPinDto } from './profiles.dto';

@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getProfiles(@CurrentUser() user: UserRequest) {
    return this.prisma.profile.findMany({
      where: { userId: user.id },
      select: publicProfileSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  @Post()
  async createProfile(
    @CurrentUser() user: UserRequest,
    @Body() dto: CreateProfileDto,
  ) {
    if (dto.name.length < 1) {
      throw new BadRequestException('Name is required');
    }

    // Check max profiles limit (5)
    const profileCount = await this.prisma.profile.count({
      where: { userId: user.id },
    });
    if (profileCount >= 5) {
      throw new ConflictException('Maximum 5 profiles allowed');
    }

    const pinHash = dto.pin
      ? await argon2.hash(dto.pin, { type: argon2.argon2id, memoryCost: 2 ** 16, timeCost: 3, parallelism: 1 })
      : undefined;

    return this.prisma.profile.create({
      data: {
        userId: user.id,
        name: dto.name,
        isKid: dto.isKid,
        maturityMax: dto.maturityMax || 'PG-13',
        pinHash,
      },
      select: publicProfileSelect,
    });
  }

  @Put(':id')
  async updateProfile(
    @CurrentUser() user: UserRequest,
    @Param('id') id: string,
    @Body() dto: UpdateProfileDto,
  ) {
    const profile = await this.prisma.profile.findFirst({
      where: { id, userId: user.id },
    });
    if (!profile) throw new NotFoundException('Profile not found');

    const data: Prisma.ProfileUpdateInput = {};
    if (dto.name) data.name = dto.name;
    if (dto.isKid !== undefined) data.isKid = dto.isKid;
    if (dto.maturityMax) data.maturityMax = dto.maturityMax;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;
    if (dto.pin) {
      data.pinHash = await argon2.hash(dto.pin, { type: argon2.argon2id, memoryCost: 2 ** 16, timeCost: 3, parallelism: 1 });
    }

    return this.prisma.profile.update({ where: { id, userId: user.id }, data, select: publicProfileSelect });
  }

  @Delete(':id')
  async deleteProfile(
    @CurrentUser() user: UserRequest,
    @Param('id') id: string,
  ) {
    const profile = await this.prisma.profile.findFirst({
      where: { id, userId: user.id },
    });
    if (!profile) throw new NotFoundException('Profile not found');

    // Don't allow deleting the last profile
    const profileCount = await this.prisma.profile.count({ where: { userId: user.id } });
    if (profileCount <= 1) {
      throw new ConflictException('Cannot delete the last profile');
    }

    await this.prisma.profile.delete({ where: { id, userId: user.id } });
    return { success: true };
  }

  @Post(':id/verify-pin')
  async verifyPin(
    @CurrentUser() user: UserRequest,
    @Param('id') id: string,
    @Body() dto: VerifyPinDto,
  ) {
    const profile = await this.prisma.profile.findFirst({
      where: { id, userId: user.id },
    });
    if (!profile) throw new NotFoundException('Profile not found');

    if (!profile.pinHash) {
      throw new BadRequestException('Profile has no PIN set');
    }

    const isValid = await argon2.verify(profile.pinHash, dto.pin);
    if (!isValid) {
      throw new BadRequestException('Invalid PIN');
    }

    return { success: true };
  }
}
