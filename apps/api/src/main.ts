import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { PrismaService } from './prisma.service';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import type { Request, Response } from 'express';

import {PostgresRateLimiter,sharedRateLimiter} from './common/shared-rate-limiter';
import { rateLimiter } from './common/rate-limiter';
import { validateProductionConfig } from './common/production-config';

async function bootstrap() {
  validateProductionConfig(process.env);
  const app = await NestFactory.create(AppModule);
  const prisma = app.get(PrismaService);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Cookie parser
  app.use(cookieParser());
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Rate limiting (applied to all routes)
  if(process.env.RATE_LIMIT_STORE&& !['local','postgres'].includes(process.env.RATE_LIMIT_STORE))throw new Error('RATE_LIMIT_STORE_INVALID');
  app.use(process.env.RATE_LIMIT_STORE==='postgres'?sharedRateLimiter(new PostgresRateLimiter(prisma)):rateLimiter);

  // CORS configuration
  app.enableCors({
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : ['http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Shutdown hooks
  await prisma.enableShutdownHooks(app);

  // Health check endpoint (via Express instance)
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/health', async (req: Request, res: Response) => {
    try {
      await prisma.checkConnection();
      res.status(200).json({
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
      });
    } catch (err) {
      res.status(503).json({
        status: 'unhealthy',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  });

  const port = Number(process.env.PORT || process.env.API_PORT || 3000);
  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`Aether API is running on port ${port}`);
  logger.log(`CORS origins: ${process.env.CORS_ORIGINS || 'localhost:3001,3002,3003'}`);
  logger.log('Rate limiting: 100 requests/min; 10 auth requests/min; store='+ (process.env.RATE_LIMIT_STORE==='postgres'?'shared PostgreSQL':'local per-instance (not distributed)'));


}

bootstrap();
