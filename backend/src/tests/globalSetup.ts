import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

export default async function globalSetup() {
  // Ensure NODE_ENV=test
  process.env.NODE_ENV = 'test';

  // Load .env and .env.test manually for this setup context since jest may not have loaded env yet
  const dotenv = require('dotenv');
  const root = path.resolve(__dirname, '../../');
  const envPath = path.join(root, '.env');
  const envTestPath = path.join(root, '.env.test');
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
  if (fs.existsSync(envTestPath)) dotenv.config({ path: envTestPath, override: true });

  // Prefer TEST_DATABASE_URL if present
  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  }

  // Resolve Prisma CLI binary path cross-platform
  const prismaBin = path.resolve(
    root,
    'node_modules/.bin/prisma' + (process.platform === 'win32' ? '.cmd' : '')
  );

  // Run db push once before all suites; skip generate to avoid EPERM rename on Windows if engine is in use
  execSync(`"${prismaBin}" db push --force-reset --schema "${path.join(root, 'prisma', 'schema.prisma')}"`, { stdio: 'inherit' });
}
