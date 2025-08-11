import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './database.setup';

// Global test setup
beforeAll(async () => {
  await setupTestDatabase();
});

// Global test teardown
afterAll(async () => {
  await teardownTestDatabase();
});

// Clear database before each test to ensure isolation
beforeEach(async () => {
  await clearTestDatabase();
});

// Increase timeout for database operations
jest.setTimeout(30000);

// Mock console methods in tests to reduce noise
const originalConsole = console;
beforeAll(() => {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = originalConsole.error; // Keep error logging for debugging
});

afterAll(() => {
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});