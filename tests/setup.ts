// Vitest setup file
import { beforeAll, afterAll, afterEach } from 'vitest';

// Setup any global test configurations here

beforeAll(() => {
  // Setup before all tests
  console.log('Starting test suite...');
});

afterEach(() => {
  // Cleanup after each test
});

afterAll(() => {
  // Cleanup after all tests
  console.log('Test suite complete.');
});

// Mock environment variables for tests
process.env.DATABASE_URL = 'file:./test.db';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
