import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// Note: In production, use dependency injection in NestJS modules.
// This is a helper for Admin Panel API routes (Next.js API Routes or Server Components).
