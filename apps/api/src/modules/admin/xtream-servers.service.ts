import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma.service';
import { Prisma } from '@prisma/client';
import { failoverCandidates, isValidPriority, selectServer, MAX_PRIORITY, MIN_PRIORITY } from './xtream-selection';
import { XtreamProviderAdapter } from './xtream-provider.adapter';
import { XtreamHealthService, MAX_SERVERS_PER_SWEEP } from './xtream-health.service';

type ServerInput = {
  name: string; baseUrl: string; username: string; password?: string;
  priority?: number; isDefault?: boolean;
};

@Injectable()
export class XtreamServersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly health: XtreamHealthService,
  ) {}

  /** Internal only: normalized metadata, never return decrypted account data. */
  async retrieveCatalog(tenantId: string, id: string, adapter: XtreamProviderAdapter, signal: AbortSignal) {
    const server = await this.prisma.xtreamServer.findFirst({ where: { id, tenantId, enabled: true } });
    if (!server) throw new NotFoundException('Enabled Xtream server not found');
    return adapter.retrieve(server.baseUrl, server.username, this.decryptSecret(server.passwordEncrypted), signal);
  }

  private key(): Buffer {
    const value = process.env.XTREAM_ENCRYPTION_KEY;
    if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) {
      throw new InternalServerErrorException('XTREAM_ENCRYPTION_KEY must be configured as 64 hex characters');
    }
    return Buffer.from(value, 'hex');
  }

  encryptSecret(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64')).join('.');
  }

  /**
   * Decrypt a stored password for a server-side probe only.
   *
   * Server-only: the plaintext is never returned by any method, never logged,
   * and never included in an error message. A tampered or truncated ciphertext
   * fails GCM authentication and throws, rather than yielding garbage.
   */
  decryptSecret(value: string): string {
    const parts = value.split('.');
    if (parts.length !== 3) throw new InternalServerErrorException('Stored credential is malformed');
    try {
      const [iv, tag, payload] = parts.map(part => Buffer.from(part, 'base64'));
      const decipher = createDecipheriv('aes-256-gcm', this.key(), iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(payload), decipher.final()]).toString('utf8');
    } catch {
      // Deliberately opaque: never echo the ciphertext or the crypto error.
      throw new InternalServerErrorException('Stored credential could not be decrypted');
    }
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
    if (input.priority !== undefined && !isValidPriority(input.priority)) {
      throw new BadRequestException(`priority must be an integer between ${MIN_PRIORITY} and ${MAX_PRIORITY}`);
    }
    if (input.isDefault !== undefined && typeof input.isDefault !== 'boolean') {
      throw new BadRequestException('isDefault must be boolean');
    }
  }

  private safe<T extends { passwordEncrypted: string }>(server: T) {
    const { passwordEncrypted, ...publicFields } = server;
    return publicFields;
  }

  async list(tenantId: string) {
    const rows = await this.prisma.xtreamServer.findMany({
      where: { tenantId },
      // Mirror the selection order so the admin UI shows the effective preference.
      orderBy: [{ isDefault: 'desc' }, { priority: 'asc' }, { name: 'asc' }],
    });
    return rows.map(row => this.safe(row));
  }

  /**
   * Ordered, enabled failover candidates for playback. Bounded so a caller can
   * never retry an unreachable origin without limit. Credentials stay encrypted
   * and are stripped from the result.
   */
  async candidates(tenantId: string, maxAttempts = 3) {
    const rows = await this.prisma.xtreamServer.findMany({ where: { tenantId, enabled: true } });
    return failoverCandidates(rows, maxAttempts).map(row => this.safe(row));
  }

  /** The single preferred server, or null when none is enabled. */
  async preferred(tenantId: string) {
    const rows = await this.prisma.xtreamServer.findMany({ where: { tenantId, enabled: true } });
    const chosen = selectServer(rows);
    return chosen ? this.safe(chosen) : null;
  }

  async create(tenantId: string, input: ServerInput) {
    this.validate(input);
    if (!input.password) throw new BadRequestException('password is required');
    const data = {
      tenantId, name: input.name.trim(), baseUrl: input.baseUrl.replace(/\/+$/, ''),
      username: input.username.trim(), passwordEncrypted: this.encryptSecret(input.password),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
    };

    // Only one default per tenant. Clearing the previous default and setting the
    // new one must be atomic, or a failure between the two writes would leave
    // the tenant with no default at all.
    if (input.isDefault) {
      const created = await this.prisma.$transaction(async tx => {
        await tx.xtreamServer.updateMany({ where: { tenantId, isDefault: true }, data: { isDefault: false } });
        return tx.xtreamServer.create({ data });
      });
      return this.safe(created);
    }

    return this.safe(await this.prisma.xtreamServer.create({ data }));
  }

  /** Promote a server to default, atomically demoting the previous one. */
  async setDefault(tenantId: string, id: string) {
    const existing = await this.prisma.xtreamServer.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Xtream server not found');
    if (!existing.enabled) throw new BadRequestException('Enable the server before making it the default');

    const updated = await this.prisma.$transaction(async tx => {
      await tx.xtreamServer.updateMany({ where: { tenantId, isDefault: true }, data: { isDefault: false } });
      return tx.xtreamServer.update({ where: { id }, data: { isDefault: true } });
    });
    return this.safe(updated);
  }

  /** Change selection preference without touching credentials. */
  async setPriority(tenantId: string, id: string, priority: number) {
    if (!isValidPriority(priority)) {
      throw new BadRequestException(`priority must be an integer between ${MIN_PRIORITY} and ${MAX_PRIORITY}`);
    }
    const existing = await this.prisma.xtreamServer.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Xtream server not found');
    return this.safe(await this.prisma.xtreamServer.update({ where: { id }, data: { priority } }));
  }

  async update(tenantId: string, id: string, input: Partial<ServerInput>) {
    this.validate(input as ServerInput, true);
    const existing = await this.prisma.xtreamServer.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Xtream server not found');
    const data: Prisma.XtreamServerUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.baseUrl !== undefined) data.baseUrl = input.baseUrl.replace(/\/+$/, '');
    if (input.username !== undefined) data.username = input.username.trim();
    if (input.password !== undefined) data.passwordEncrypted = this.encryptSecret(input.password);
    if (input.priority !== undefined) data.priority = input.priority;

    if (input.isDefault === true) {
      if (!existing.enabled) throw new BadRequestException('Enable the server before making it the default');
      const updated = await this.prisma.$transaction(async tx => {
        await tx.xtreamServer.updateMany({ where: { tenantId, isDefault: true }, data: { isDefault: false } });
        return tx.xtreamServer.update({ where: { id }, data: { ...data, isDefault: true } });
      });
      return this.safe(updated);
    }
    if (input.isDefault === false) data.isDefault = false;

    return this.safe(await this.prisma.xtreamServer.update({ where: { id }, data }));
  }

  async toggle(tenantId: string, id: string, enabled: boolean) {
    if (typeof enabled !== 'boolean') throw new BadRequestException('enabled must be boolean');
    const existing = await this.prisma.xtreamServer.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Xtream server not found');
    // Disabling the default clears the flag, so the tenant is never left with a
    // default that selection would silently ignore.
    const data: Prisma.XtreamServerUpdateInput = { enabled };
    if (!enabled && existing.isDefault) data.isDefault = false;
    return this.safe(await this.prisma.xtreamServer.update({ where: { id }, data }));
  }

  /**
   * Probe one server and persist the honest outcome.
   *
   * `force` bypasses the recheck interval for an explicit operator action; the
   * automatic sweep never forces, so a dead origin is not hammered.
   */
  async checkHealth(tenantId: string, id: string, force = false) {
    const existing = await this.prisma.xtreamServer.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Xtream server not found');

    if (!force && !this.health.shouldRecheck(existing.lastCheckedAt)) {
      // Return the recorded status rather than probing again.
      return { ...this.safe(existing), skipped: true as const, reason: 'RECENTLY_CHECKED' as const };
    }

    const result = await this.health.probe(
      { baseUrl: existing.baseUrl, username: existing.username, password: this.decryptSecret(existing.passwordEncrypted) },
      process.env.XTREAM_ALLOW_HTTP === 'true',
    );

    const updated = await this.prisma.xtreamServer.update({
      where: { id },
      data: { connectionStatus: result.status, lastCheckedAt: result.checkedAt },
    });

    return {
      ...this.safe(updated), skipped: false as const,
      reason: result.reason, latencyMs: result.latencyMs, httpStatus: result.httpStatus,
    };
  }

  /**
   * Bounded health sweep across enabled servers.
   *
   * Sequential on purpose: a parallel fan-out would multiply load on a provider
   * that may already be struggling. Capped at MAX_SERVERS_PER_SWEEP and skips
   * recently checked servers.
   */
  async checkAllHealth(tenantId: string) {
    const rows = await this.prisma.xtreamServer.findMany({
      where: { tenantId, enabled: true },
      orderBy: [{ isDefault: 'desc' }, { priority: 'asc' }],
      take: MAX_SERVERS_PER_SWEEP,
    });

    const results: Array<Awaited<ReturnType<XtreamServersService['checkHealth']>>> = [];
    for (const row of rows) {
      results.push(await this.checkHealth(tenantId, row.id));
    }
    return { checked: results.filter(r => !r.skipped).length, skipped: results.filter(r => r.skipped).length, results };
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.xtreamServer.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Xtream server not found');
    await this.prisma.xtreamServer.delete({ where: { id } });
    return { success: true };
  }
}
