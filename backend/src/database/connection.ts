import { PrismaClient } from '@prisma/client';
import { config } from '../config/env';

// Global Prisma instance to prevent multiple connections
declare global {
  var __prisma: PrismaClient | undefined;
}

// Create Prisma client with logging configuration
const createPrismaClient = () => {
  return new PrismaClient({
    log: config.env === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    errorFormat: 'pretty',
  });
};

// Use global instance in development to prevent hot reload issues
export const prisma = globalThis.__prisma || createPrismaClient();

if (config.env === 'development') {
  globalThis.__prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

// Database health check
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
};

// Database transaction helper
export const withTransaction = async <T>(
  callback: (prisma: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>
): Promise<T> => {
  return await prisma.$transaction(callback);
};