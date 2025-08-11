#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

interface SetupOptions {
  skipDb?: boolean;
  seed?: boolean;
}

class SimpleSetup {
  private options: SetupOptions;

  constructor(options: SetupOptions = {}) {
    this.options = options;
  }

  async run(): Promise<void> {
    try {
      console.log('🚀 Starting simple database setup...\n');

      // Step 1: Generate Prisma client
      await this.generateClient();

      if (!this.options.skipDb) {
        // Step 2: Show database creation instructions
        this.showDatabaseInstructions();

        // Step 3: Try to run migrations
        await this.runMigrations();

        // Step 4: Seed database if requested
        if (this.options.seed) {
          await this.seedDatabase();
        }
      }

      console.log('\n🎉 Setup completed!');
      this.showNextSteps();
      
    } catch (error) {
      console.error('\n❌ Setup failed:', error);
      this.showTroubleshooting();
      process.exit(1);
    }
  }

  private async generateClient(): Promise<void> {
    console.log('🔧 Generating Prisma client...');
    
    try {
      execSync('npx prisma generate', { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log('✅ Prisma client generated successfully');
    } catch (error) {
      throw new Error(`Failed to generate Prisma client: ${error}`);
    }
  }

  private showDatabaseInstructions(): void {
    console.log('📋 Database Setup Instructions:');
    console.log('');
    console.log('1. Make sure MySQL is running on your system');
    console.log('2. Connect to MySQL as root or admin user:');
    console.log('   mysql -u root -p');
    console.log('');
    console.log('3. Create the database:');
    console.log('   CREATE DATABASE IF NOT EXISTS `ticket_system` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
    console.log('');
    console.log('4. Verify the database was created:');
    console.log('   SHOW DATABASES LIKE \'ticket_system\';');
    console.log('');
    console.log('Alternatively, you can run the SQL script:');
    console.log('   mysql -u root -p < src/scripts/create-database.sql');
    console.log('');
  }

  private async runMigrations(): Promise<void> {
    console.log('📦 Running database migrations...');
    
    try {
      // Check if migrations directory exists
      const migrationsDir = join(process.cwd(), 'prisma', 'migrations');
      const isFirstMigration = !existsSync(migrationsDir);

      if (isFirstMigration) {
        console.log('   Creating initial migration...');
        execSync('npx prisma migrate dev --name init', { 
          stdio: 'inherit',
          cwd: process.cwd()
        });
      } else {
        console.log('   Applying pending migrations...');
        execSync('npx prisma migrate dev', { 
          stdio: 'inherit',
          cwd: process.cwd()
        });
      }
      
      console.log('✅ Migrations completed successfully');
    } catch (error) {
      console.log('⚠️  Migration failed. This is normal if the database doesn\'t exist yet.');
      console.log('   Please create the database first, then run: npm run db:migrate');
      throw error;
    }
  }

  private async seedDatabase(): Promise<void> {
    console.log('🌱 Seeding database...');
    
    try {
      execSync('npm run db:seed', { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log('✅ Database seeded successfully');
    } catch (error) {
      console.log('⚠️  Database seeding failed');
      throw error;
    }
  }

  private showNextSteps(): void {
    console.log('\n📝 Next Steps:');
    console.log('');
    console.log('1. If migrations failed, create the database manually and run:');
    console.log('   npm run db:migrate');
    console.log('');
    console.log('2. To seed the database with test data:');
    console.log('   npm run db:seed');
    console.log('');
    console.log('3. To start the development server:');
    console.log('   npm run dev');
    console.log('');
    console.log('4. To check database status:');
    console.log('   npm run db:health');
    console.log('');
  }

  private showTroubleshooting(): void {
    console.log('\n🔧 Troubleshooting:');
    console.log('');
    console.log('If you see authentication errors:');
    console.log('1. Check your DATABASE_URL in .env file');
    console.log('2. Make sure MySQL is running');
    console.log('3. Verify your MySQL credentials');
    console.log('4. Try connecting manually: mysql -u root -p');
    console.log('');
    console.log('Common MySQL authentication issues:');
    console.log('- Use mysql_native_password instead of caching_sha2_password');
    console.log('- Update your MySQL user: ALTER USER \'root\'@\'localhost\' IDENTIFIED WITH mysql_native_password BY \'password\';');
    console.log('');
  }
}

// Parse command line arguments
function parseArgs(): SetupOptions {
  const args = process.argv.slice(2);
  return {
    skipDb: args.includes('--skip-db'),
    seed: args.includes('--seed'),
  };
}

// Main execution
async function main() {
  const options = parseArgs();
  const setup = new SimpleSetup(options);
  await setup.run();
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}

export { SimpleSetup };