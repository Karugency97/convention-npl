// Jest setup file for E2E tests
// This file runs before all tests

// Increase timeout for E2E tests (database operations may be slow)
jest.setTimeout(30000);

// Set test environment
process.env.NODE_ENV = 'test';
