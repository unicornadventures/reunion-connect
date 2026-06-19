import jest from 'jest';

// Mock the database module
jest.mock('../src/db.ts', () => ({
  query: jest.fn(),
}));

// Mock environment variables
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USER = 'test';
process.env.DB_PASS = 'test';
process.env.DB_NAME = 'test_db';
process.env.S3_ENDPOINT = 'http://localhost:4566';
process.env.BACKEND_PORT = '5001';
