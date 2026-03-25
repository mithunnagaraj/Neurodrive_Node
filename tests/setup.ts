/**
 * Jest setup file
 * Runs before all tests
 */

// Mock logger to avoid console noise during tests
jest.mock('../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    http: jest.fn(),
  },
}));

// Set test environment variables
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3001';
process.env['JWT_SECRET'] = 'test-secret-key';
process.env['ROUTER_LENGTH_THRESHOLD'] = '100';
process.env['ROUTER_SHORT_MESSAGE_PROVIDER'] = 'gemini';
process.env['ROUTER_LONG_MESSAGE_PROVIDER'] = 'openai';

// Increase timeout for async operations
jest.setTimeout(10000);

// Global test utilities
global.console = {
  ...console,
  error: jest.fn(), // Suppress error logs during tests
  warn: jest.fn(),  // Suppress warning logs during tests
};
