import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /** Health/readiness only: reconnect a stale pool after an outage. Never replay
   * application writes or transactions whose commit result may be ambiguous. */
  async checkConnection(): Promise<void> {
    try { await this.$queryRaw`SELECT 1`; }
    catch {
      await this.$disconnect();
      await this.$connect();
      await this.$queryRaw`SELECT 1`;
    }
  }

  async enableShutdownHooks(app: INestApplication) {
    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}, closing database connections`);
      await app.close();
      process.exit(0);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }
}
