#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import mysql from 'mysql2/promise';
import { checkDatabaseConnection } from '../database/connection';
import { seedDatabase } from '../database/seed';

interface SetupOptions {
  reset?: boolean;
  noSeed?: boolean;
  force?: boolean;
}

class DatabaseSetup {
  private options: SetupOptions;

  constructor(options: SetupOptions = {}) {
    this.options = options;
  }

  async run(): Promise<void> {
    try {
      console.log('🚀 Starting database setup...\n');

      // Create database if it doesn't exist
      await this.createDatabase();

      // Generate Prisma client first
      await this.generateClient();

      // Check if database is accessible
      const isConnected = await this.checkConnection();

      // Handle reset option
      if (this.options.reset && isConnected) {
        await this.resetDatabase();
      }

      // Run migrations if database is connected
      if (isConnected) {
        await this.runMigrations();

        // Seed database if requested
        if (!this.options.noSeed) {
          await this.seedDatabase();
        }
      } else {
        console.log('⚠️  Database not accessible. Please run migrations manually when database is ready.');
        console.log('   Use: npm run db:migrate');
      }

      console.log('\n🎉 Database setup completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Database setup failed:', error);
      process.exit(1);
    }
  }

  private async createDatabase(): Promise<void> {
    console.log('� ️  Creating database if it doesn\'t exist...');
    
    try {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable is not set');
      }

      // Parse database URL
      const url = new URL(databaseUrl);
      const host = url.hostname;
      const port = parseInt(url.port) || 3306;
      const database = url.pathname.slice(1); // Remove leading slash
      const username = url.username;
      const password = url.password;

      // Connect to MySQL server (without specifying database)
      const connection = await mysql.createConnection({
        host,
        port,
        user: username,
        password,
      });

      // Create database if it doesn't exist
      await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      
      console.log(`✅ Database '${database}' is ready`);
      
      await connection.end();
    } catch (error) {
      console.log('⚠️  Could not create database:', error instanceof Error ? error.message : 'Unknown error');
      console.log('   Please ensure MySQL is running and credentials are correct.');
      console.log('   You may need to create the database manually.');
    }
  }

  private async checkConnection(): Promise<boolean> {
    console.log('🔍 Checking database connection...');
    
    try {
      const isConnected = await checkDatabaseConnection();
      if (isConnected) {
        console.log('✅ Database connection successful');
        return true;
      } else {
        console.log('⚠️  Database connection failed');
        return false;
      }
    } catch (error) {
      console.log('⚠️  Database connection failed:', error instanceof Error ? error.message : 'Unknown error');
      console.log('   This is normal if the database doesn\'t exist yet.');
      return false;
    }
  }

  private async generateClient(): Promise<void> {
    console.log('🔧 Generating Prisma client...');
    
    try {
      execSync('npx prisma generate', { 
        stdio: 'pipe',
        cwd: process.cwd()
      });
      console.log('✅ Prisma client generated');
    } catch (error) {
      console.log('⚠️  Prisma client generation failed, but continuing...');
      console.log('   You may need to run: npm run db:generate');
    }
  }

  private async runMigrations(): Promise<void> {
    console.log('📦 Running database migrations...');
    
    try {
      // Check if this is the first migration
      const migrationsDir = join(process.cwd(), 'backend', 'prisma', 'migrations');
      const isFirstMigration = !existsSync(migrationsDir);

      if (isFirstMigration) {
        console.log('   Creating initial migration...');
        execSync('npx prisma migrate dev --name init', { 
          stdio: 'pipe',
          cwd: process.cwd()
        });
      } else {
        console.log('   Applying pending migrations...');
        execSync('npx prisma migrate dev', { 
          stdio: 'pipe',
          cwd: process.cwd()
        });
      }
      
      console.log('✅ Migrations completed');
    } catch (error) {
      throw new Error(`Failed to run migrations: ${error}`);
    }
  }

  private async resetDatabase(): Promise<void> {
    console.log('🔄 Resetting database...');
    
    if (!this.options.force) {
      console.log('⚠️  This will delete all data in the database!');
      // In a real scenario, you might want to add a confirmation prompt here
    }

    try {
      execSync('npx prisma migrate reset --force', { 
        stdio: 'pipe',
        cwd: process.cwd()
      });
      console.log('✅ Database reset completed');
    } catch (error) {
      throw new Error(`Failed to reset database: ${error}`);
    }
  }

  private async seedDatabase(): Promise<void> {
    console.log('🌱 Seeding database...');
    
    try {
      await seedDatabase();
      console.log('✅ Database seeding completed');
    } catch (error) {
      console.error('⚠️  Database seeding failed:', error);
      console.log('   Continuing without seed data...');
    }
  }
}

// Parse command line arguments
function parseArgs(): SetupOptions {
  const args = process.argv.slice(2);
  return {
    reset: args.includes('--reset'),
    noSeed: args.includes('--no-seed'),
    force: args.includes('--force'),
  };
}

// Main execution
async function main() {
  const options = parseArgs();
  const setup = new DatabaseSetup(options);
  await setup.run();
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}

export { DatabaseSetup };