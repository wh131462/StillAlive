import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

export const prisma = new PrismaClient({
  log: env.isDev ? ['warn', 'error'] : ['error'],
});

export type { Prisma } from '@prisma/client';
