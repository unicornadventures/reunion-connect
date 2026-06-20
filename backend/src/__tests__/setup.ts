// Global test setup and teardown
beforeAll(() => {
  // Setup any global test configuration
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key';
  process.env.DB_HOST = 'localhost';
  process.env.DB_USER = 'test';
  process.env.DB_PASS = 'test';
  process.env.DB_NAME = 'test_db';
});

afterAll(() => {
  // Cleanup
  jest.clearAllMocks();
});
