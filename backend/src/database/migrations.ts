#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { DatabaseUtils } from './utils';

interface MigrationOptions {
  name?: string;
  force?: boolean;
}

class MigrationManager {
  private backendPath: string;

  constructor() {
    this.backendPath = join(process.cwd(), 'backend');
  }

  /**
   * Initialize the migration system
   */
  async init(): Promise<void> {
    try {
      console.log('🚀 Initializing migration system...');

      // Ensure prisma directory exists
      const prismaDir = join(this.backendPath, 'prisma');
      if (!existsSync(prismaDir)) {
        mkdirSync(prismaDir, { recursive: true });
        console.log('✅ Created prisma directory');
      }

      // Create initial migration
      console.log('📦 Creating initial migration...');
      execSync('npx prisma migrate dev --name init', {
        stdio: 'inherit',
        cwd: this.backendPath,
      });

      console.log('✅ Migration system initialized');
    } catch (error) {
      console.error('❌ Failed to initialize migrations:', error);
      throw error;
    }
  }

  /**
   * Create a new migration
   */
  async create(options: MigrationOptions = {}): Promise<void> {
    try {
      const migrationName = options.name || `migration_${Date.now()}`;
      
      console.log(`🔧 Creating migration: ${migrationName}`);

      // Create migration
      execSync(`npx prisma migrate dev --name ${migrationName}`, {
        stdio: 'inherit',
        cwd: this.backendPath,
      });

      console.log(`✅ Migration created: ${migrationName}`);
    } catch (error) {
      console.error('❌ Failed to create migration:', error);
      throw error;
    }
  }

  /**
   * Run pending migrations
   */
  async migrate(options: MigrationOptions = {}): Promise<void> {
    try {
      console.log('📦 Running pending migrations...');

      // Check database health first
      const health = await DatabaseUtils.healthCheck();
      if (!health.connected) {
        throw new Error(`Database connection failed: ${health.error}`);
      }

      // Run migrations
      if (options.force) {
        execSync('npx prisma migrate deploy --force', {
          stdio: 'inherit',
          cwd: this.backendPath,
        });
      } else {
        execSync('npx prisma migrate deploy', {
          stdio: 'inherit',
          cwd: this.backendPath,
        });
      }

      // Validate schema after migration
      const isValid = await DatabaseUtils.validateSchema();
      if (!isValid) {
        throw new Error('Schema validation failed after migration');
      }

      console.log('✅ Migrations completed successfully');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Reset all migrations (dangerous!)
   */
  async reset(options: MigrationOptions = {}): Promise<void> {
    try {
      console.log('⚠️  Resetting all migrations...');
      
      if (!options.force) {
        console.log('❌ Reset requires --force flag for safety');
        return;
      }

      // Create backup before reset
      const backupPath = join(process.cwd(), `backup_${Date.now()}.sql`);
      try {
        await DatabaseUtils.createBackup(backupPath);
        console.log(`📦 Backup created: ${backupPath}`);
      } catch (error) {
        console.log('⚠️  Could not create backup, continuing with reset...');
      }

      // Reset migrations
      execSync('npx prisma migrate reset --force', {
        stdio: 'inherit',
        cwd: this.backendPath,
      });

      console.log('✅ Migrations reset completed');
    } catch (error) {
      console.error('❌ Migration reset failed:', error);
      throw error;
    }
  }

  /**
   * Get migration status
   */
  async status(): Promise<void> {
    try {
      console.log('📊 Migration status:');
      
      execSync('npx prisma migrate status', {
        stdio: 'inherit',
        cwd: this.backendPath,
      });

      // Also show database stats
      const stats = await DatabaseUtils.getStats();
      console.log('\n📈 Database Statistics:');
      console.log(`  Users: ${stats.users}`);
      console.log(`  Tickets: ${stats.tickets} (${stats.openTickets} open, ${stats.closedTickets} closed)`);
      console.log(`  Comments: ${stats.comments}`);

    } catch (error) {
      console.error('❌ Failed to get migration status:', error);
      throw error;
    }
  }
}

// Parse command line arguments
function parseArgs(): { command: string; options: MigrationOptions } {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';
  
  const options: MigrationOptions = {
    name: args.find(arg => arg.startsWith('--name='))?.split('=')[1],
    force: args.includes('--force'),
  };

  return { command, options };
}

// Main execution
async function main() {
  const { command, options } = parseArgs();
  const manager = new MigrationManager();

  switch (command) {
    case 'init':
      await manager.init();
      break;
    case 'create':
      await manager.create(options);
      break;
    case 'migrate':
      await manager.migrate(options);
      break;
    case 'reset':
      await manager.reset(options);
      break;
    case 'status':
      await manager.status();
      break;
    default:
      console.log('Available commands:');
      console.log('  init     - Initialize migration system');
      console.log('  create   - Create new migration (--name=migration_name)');
      console.log('  migrate  - Run pending migrations (--force)');
      console.log('  reset    - Reset all migrations (--force required)');
      console.log('  status   - Show migration status');
      break;
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Migration command failed:', error);
    process.exit(1);
  });
}

export { MigrationManager };