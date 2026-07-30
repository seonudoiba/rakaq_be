import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { env } from './environment';

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

const getPrismaClient = (): PrismaClient => {
  if (globalThis.prismaGlobal) {
    return globalThis.prismaGlobal;
  }

  const connectionString = env.DATABASE_URL || process.env.DATABASE_URL;

  let prismaInstance: PrismaClient;

  if (connectionString) {
    const pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    const adapter = new PrismaPg(pool);
    prismaInstance = new PrismaClient({
      adapter,
      log: env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  } else {
    prismaInstance = new PrismaClient({
      log: ['error'],
    });
  }

  if (env.NODE_ENV !== 'production') {
    globalThis.prismaGlobal = prismaInstance;
  }

  return prismaInstance;
};

export const prisma = getPrismaClient();