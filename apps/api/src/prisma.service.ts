import {drainHttpServer,trackHttpServer} from './common/http-drain';
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
    const inFlight=trackHttpServer(app.getHttpServer());
    let shuttingDown=false;
    const shutdown = async (signal: string) => {
      if(shuttingDown)return;shuttingDown=true;
      console.log(`Received ${signal}, draining HTTP before database shutdown`);
      console.log('HTTP_DRAIN_STARTED active='+inFlight());
      try{
        await drainHttpServer(app.getHttpServer());
        console.log('HTTP_DRAIN_COMPLETED active='+inFlight());
        await app.close();
        process.exit(0);
      }catch{
        // Fixed event only, never URL/headers/tokens. Deadline is not lossless.
        console.error('HTTP_DRAIN_FAILED');
        process.exit(1);
      }
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }
}
