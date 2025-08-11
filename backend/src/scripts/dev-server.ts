#!/usr/bin/env ts-node

import 'tsconfig-paths/register';
import { config } from '../config/env';
import { DatabaseSetup } from './setup-database';
import { checkDatabaseConnection } from '../database/connection';

async function startDevServer() {
  try {
    console.log('🚀 Starting development server...\n');

    // Check if database needs setup
    const isConnected = await checkDatabaseConnection();
    
    if (!isConnected) {
      console.log('📦 Database not ready, running setup...');
      const setup = new DatabaseSetup({ noSeed: false });
      await setup.run();
      console.log('');
    } else {
      console.log('✅ Database connection verified');
    }

    // Start the actual server
    console.log('🌐 Starting Express server...');
    const { startServer } = require('../server');
    await startServer();

  } catch (error) {
    console.error('❌ Failed to start development server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down development server...');
  process.exit(0);
});

// Start the server
startDevServer();