// Main database exports
export { prisma, checkDatabaseConnection, withTransaction } from './connection';
export { DatabaseUtils } from './utils';
export * from './errors';

// Database initialization function
export const initializeDatabase = async (): Promise<void> => {
  try {
    const { checkDatabaseConnection } = await import('./connection');
    const isConnected = await checkDatabaseConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to database');
    }
    console.log('✅ Database connection established');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};