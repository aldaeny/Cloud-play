import { publicProfileSelect, publicStaffSelect } from '../../common/public-select';
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import * as argon2 from 'argon2';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsers(tenantId: string, page = 1, pageSize = 20) {
    const [users, total] = await Promise.all([
      this.prisma.appUser.findMany({
        where: { tenantId },
        select: {
          id: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
          subscriptions: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.appUser.count({ where: { tenantId } }),
    ]);

    return { users, total, page, pageSize };
  }

  async getUser(tenantId: string, id: string) {
    const user = await this.prisma.appUser.findFirst({
      where: { id, tenantId },
      select: {
        id: true, tenantId: true, email: true, phone: true, emailVerifiedAt: true, status: true, createdAt: true,
        profiles: { select: publicProfileSelect }, devices: true, subscriptions: { include: { plan: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateUserStatus(tenantId: string, id: string, status: string) {
    // AppUser.status is a free-form string and login requires exactly 'active'.
    // Reject anything outside the known set so an admin typo cannot silently
    // lock an account into an undefined state with no validation error.
    if (!['active', 'suspended', 'disabled'].includes(status)) {
      throw new BadRequestException('status must be one of: active, suspended, disabled');
    }
    const user = await this.prisma.appUser.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.appUser.update({
      where: { id, tenantId },
      data: { status },
    });
  }

  async getDevices(tenantId: string) {
    return this.prisma.device.findMany({
      where: { user: { tenantId } },
      include: { user: { select: { email: true } } },
      orderBy: { lastSeenAt: 'desc' },
      take: 100,
    });
  }

  async revokeDevice(tenantId: string, id: string) {
    const device = await this.prisma.device.findFirst({
      where: { id, user: { tenantId } },
    });
    if (!device) throw new NotFoundException('Device not found');

    return this.prisma.device.update({
      where: { id, user: { tenantId } },
      data: { revokedAt: new Date() },
    });
  }

  async getStaffUsers(tenantId: string) {
    return this.prisma.staffUser.findMany({
      where: { tenantId },
      select: { ...publicStaffSelect, role: true },
    });
  }

  async createStaffUser(tenantId: string, email: string, password: string, roleId: string) {
    const existing = await this.prisma.staffUser.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already exists');

    const role = await this.prisma.role.findFirst({ where: { id: roleId, tenantId }, select: { id: true } });
    if (!role) throw new NotFoundException('Role not found');

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });

    return this.prisma.staffUser.create({
      data: { tenantId, email, passwordHash, roleId },
      select: publicStaffSelect,
    });
  }

  async getRoles(tenantId: string) {
    return this.prisma.role.findMany({
      where: { tenantId },
      include: { staffUsers: { select: publicStaffSelect } },
    });
  }

  async createRole(tenantId: string, name: string, permissions: string[]) {
    return this.prisma.role.create({
      data: {
        tenantId,
        name,
        permissions: JSON.stringify(permissions),
      },
    });
  }

  async getAuditLogs(tenantId: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getTranscodeJobs(tenantId: string) {
    return this.prisma.transcodeJob.findMany({
      where: { mediaAsset: { title: { tenantId } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
