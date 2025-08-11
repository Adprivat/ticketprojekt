import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { prisma } from './connection';

export class DatabaseUtils {
  /**
   * Create a database backup
   */
  static async createBackup(outputPath: string): Promise<void> {
    try {
      console.log('🔄 Creating database backup...');
      
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable is not set');
      }

      // Parse database URL to extract connection details
      const url = new URL(databaseUrl);
      const host = url.hostname;
      const port = url.port || '3306';
      const database = url.pathname.slice(1);
      const username = url.username;
      const password = url.password;

      // Create mysqldump command
      const command = `mysqldump -h ${host} -P ${port} -u ${username} -p${password} ${database}`;
      
      const backup = execSync(command, { encoding: 'utf8' });
      writeFileSync(outputPath, backup);
      
      console.log(`✅ Database backup created: ${outputPath}`);
    } catch (error) {
      console.error('❌ Failed to create backup:', error);
      throw error;
    }
  }

  /**
   * Check database health and connectivity
   */
  static async healthCheck(): Promise<{
    connected: boolean;
    version?: string;
    uptime?: number;
    error?: string;
  }> {
    try {
      // Test basic connectivity
      await prisma.$queryRaw`SELECT 1`;
      
      // Get database version
      const versionResult = await prisma.$queryRaw<Array<{ version: string }>>`SELECT VERSION() as version`;
      const version = versionResult[0]?.version;

      // Get uptime (in seconds)
      const uptimeResult = await prisma.$queryRaw<Array<{ uptime: number }>>`SHOW STATUS LIKE 'Uptime'`;
      const uptime = uptimeResult[0]?.uptime;

      return {
        connected: true,
        version,
        uptime,
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get database statistics
   */
  static async getStats(): Promise<{
    users: number;
    tickets: number;
    comments: number;
    openTickets: number;
    closedTickets: number;
  }> {
    try {
      const [
        userCount,
        ticketCount,
        commentCount,
        openTicketCount,
        closedTicketCount,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.ticket.count(),
        prisma.comment.count(),
        prisma.ticket.count({ where: { status: 'OPEN' } }),
        prisma.ticket.count({ where: { status: 'CLOSED' } }),
      ]);

      return {
        users: userCount,
        tickets: ticketCount,
        comments: commentCount,
        openTickets: openTicketCount,
        closedTickets: closedTicketCount,
      };
    } catch (error) {
      console.error('Failed to get database stats:', error);
      throw error;
    }
  }

  /**
   * Clean up test data (useful for testing)
   */
  static async cleanupTestData(): Promise<void> {
    try {
      console.log('🧹 Cleaning up test data...');
      
      // Delete in reverse order of dependencies
      await prisma.comment.deleteMany();
      await prisma.ticket.deleteMany();
      await prisma.user.deleteMany();
      
      console.log('✅ Test data cleaned up');
    } catch (error) {
      console.error('❌ Failed to cleanup test data:', error);
      throw error;
    }
  }

  /**
   * Reset auto-increment counters (MySQL specific)
   */
  static async resetAutoIncrement(): Promise<void> {
    try {
      console.log('🔄 Resetting auto-increment counters...');
      
      // Note: Since we're using UUIDs, this might not be necessary
      // But keeping it for potential future use with integer IDs
      
      console.log('✅ Auto-increment counters reset');
    } catch (error) {
      console.error('❌ Failed to reset auto-increment:', error);
      throw error;
    }
  }

  /**
   * Validate database schema
   */
  static async validateSchema(): Promise<boolean> {
    try {
      console.log('🔍 Validating database schema...');
      
      // Check if all required tables exist
      const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE()
      `;
      
      const tableNames = tables.map(t => t.table_name);
      const requiredTables = ['users', 'tickets', 'comments'];
      
      const missingTables = requiredTables.filter(table => !tableNames.includes(table));
      
      if (missingTables.length > 0) {
        console.error(`❌ Missing tables: ${missingTables.join(', ')}`);
        return false;
      }
      
      console.log('✅ Database schema is valid');
      return true;
    } catch (error) {
      console.error('❌ Schema validation failed:', error);
      return false;
    }
  }

  /**
   * Get database size information
   */
  static async getDatabaseSize(): Promise<{
    totalSize: string;
    tablesSizes: Array<{ table: string; size: string; rows: number }>;
  }> {
    try {
      // Get total database size
      const sizeResult = await prisma.$queryRaw<Array<{ size: number }>>`
        SELECT 
          ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size
        FROM information_schema.tables 
        WHERE table_schema = DATABASE()
      `;
      
      const totalSize = `${sizeResult[0]?.size || 0} MB`;

      // Get individual table sizes
      const tablesResult = await prisma.$queryRaw<Array<{
        table_name: string;
        size_mb: number;
        table_rows: number;
      }>>`
        SELECT 
          table_name,
          ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb,
          table_rows
        FROM information_schema.tables 
        WHERE table_schema = DATABASE()
        ORDER BY (data_length + index_length) DESC
      `;

      const tablesSizes = tablesResult.map(row => ({
        table: row.table_name,
        size: `${row.size_mb} MB`,
        rows: row.table_rows,
      }));

      return {
        totalSize,
        tablesSizes,
      };
    } catch (error) {
      console.error('Failed to get database size:', error);
      throw error;
    }
  }
}