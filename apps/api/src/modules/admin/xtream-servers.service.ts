import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { createCipheriv, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma.service';
import { Prisma } from '@prisma/client';

type ServerInput = { name: string; baseUrl: string; username: string; password?: string };

@Injectable()
export class XtreamServersService {
  constructor(private readonly prisma: PrismaService) {}

  private key(): Buffer {
    const value = process.env.XTREAM_ENCRYPTION_KEY;
    if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) {
      throw new InternalServerErrorException('XTREAM_ENCRYPTION_KEY must be configured as 64 hex characters');
    }
    return Buffer.from(value, 'hex');
  }

  private encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64')).join('.');
  }

  private validate(input: ServerInput, partial = false) {
    if (!partial || input.name !== undefined) {
      if (typeof input.name !== 'string' || input.name.trim().length < 2 || input.name.trim().length > 80) {
        throw new BadRequestException('name must be between 2 and 80 characters');
      }
    }
    if (!partial || input.baseUrl !== undefined) {
      let url: URL;
      try { url = new URL(input.baseUrl); } catch { throw new BadRequestException('baseUrl must be a valid URL'); }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
          url.search || url.hash || !url.hostname || url.hostname === 'localhost' ||
          url.hostname.endsWith('.localhost') || url.hostname.endsWith('.local')) {
        throw new BadRequestException('baseUrl must be an HTTP(S) server URL without credentials, query or fragment');
      }
      if (url.hostname === '::1' || /^127\./.test(url.hostname) || /^10\./.test(url.hostname) ||
          /^192\.168\./.test(url.hostname) || /^169\.254\./.test(url.hostname) ||
          /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname)) {
        throw new BadRequestException('Private and loopback server addresses are not allowed');
      }
    }
    if (!partial || input.username !== undefined) {
      if (typeof input.username !== 'string' || input.username.trim().length < 1 || input.username.length > 200) {
        throw new BadRequestException('username is required');
      }
    }
    if (input.password !== undefined && (typeof input.password !== 'string' || input.password.length < 1 || input.password.length > 500)) {
      throw new BadRequestException('password must be between 1 and 500 characters');
    }
  }

  private safe<T extends { passwordEncrypted: string }>(server: T) {
    const { passwordEncrypted, ...publicFields } = server;
    return publicFields;
  }

  async list(tenantId: string) {
    const rows = await this.prisma.xtreamServer.findMany({
      where: { tenantId }, orderBy: { createdAt: 'desc' },
    });
    return rows.map(row => this.safe(row));
  }

  async create(tenantId: string, input: ServerInput) {
    this.validate(input);
    if (!input.password) throw new BadRequestException('password is required');
    return this.safe(await this.prisma.xtreamServer.create({
      data: {
        tenantId, name: input.name.trim(), baseUrl: input.baseUrl.replace(/\/+$/, ''),
        username: input.username.trim(), passwordEncrypted: this.encrypt(input.password),
      },
    }));
  }

  async update(tenantId: string, id: string, input: Partial<ServerInput>) {
    this.validate(input as ServerInput, true);
    const existing = await this.prisma.xtreamServer.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Xtream server not found');
    const data: Prisma.XtreamServerUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.baseUrl !== undefined) data.baseUrl = input.baseUrl.replace(/\/+$/, '');
    if (input.username !== undefined) data.username = input.username.trim();
    if (input.password !== undefined) data.passwordEncrypted = this.encrypt(input.password);
    return this.safe(await this.prisma.xtreamServer.update({ where: { id }, data }));
  }

  async toggle(tenantId: string, id: string, enabled: boolean) {
    if (typeof enabled !== 'boolean') throw new BadRequestException('enabled must be boolean');
    const existing = await this.prisma.xtreamServer.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Xtream server not found');
    return this.safe(await this.prisma.xtreamServer.update({
      where: { id }, data: { enabled },
    }));
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.xtreamServer.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Xtream server not found');
    await this.prisma.xtreamServer.delete({ where: { id } });
    return { success: true };
  }
}
