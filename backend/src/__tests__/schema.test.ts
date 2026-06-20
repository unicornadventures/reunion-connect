import { initializeDatabase } from '../schema';

// Mock the database module
jest.mock('../db', () => ({
  query: jest.fn()
}));

describe('Database Schema', () => {
  let mockQuery: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    const db = require('../db');
    mockQuery = db.query;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initializeDatabase', () => {
    it('should initialize database with all tables', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await initializeDatabase();

      // Should create multiple tables
      expect(mockQuery.mock.calls.length).toBeGreaterThan(5);
    });

    it('should create schools table', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await initializeDatabase();

      const createSchoolsCalls = mockQuery.mock.calls.filter(call =>
        call[0].includes('schools') && call[0].includes('CREATE TABLE')
      );
      expect(createSchoolsCalls.length).toBeGreaterThan(0);
    });

    it('should create classes table', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await initializeDatabase();

      const createClassesCalls = mockQuery.mock.calls.filter(call =>
        call[0].includes('classes') && call[0].includes('CREATE TABLE')
      );
      expect(createClassesCalls.length).toBeGreaterThan(0);
    });

    it('should create users table', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await initializeDatabase();

      const createUsersCalls = mockQuery.mock.calls.filter(call =>
        call[0].includes('users') && call[0].includes('CREATE TABLE')
      );
      expect(createUsersCalls.length).toBeGreaterThan(0);
    });

    it('should create profiles table', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await initializeDatabase();

      const createProfilesCalls = mockQuery.mock.calls.filter(call =>
        call[0].includes('profiles') && call[0].includes('CREATE TABLE')
      );
      expect(createProfilesCalls.length).toBeGreaterThan(0);
    });

    it('should create events table', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await initializeDatabase();

      const createEventsCalls = mockQuery.mock.calls.filter(call =>
        call[0].includes('events') && call[0].includes('CREATE TABLE')
      );
      expect(createEventsCalls.length).toBeGreaterThan(0);
    });

    it('should handle database errors by catching them', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection failed'));

      // The function catches errors and doesn't re-throw
      await expect(initializeDatabase()).resolves.not.toThrow();
    });

    it('should use CREATE TABLE IF NOT EXISTS', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await initializeDatabase();

      const ifNotExistsCalls = mockQuery.mock.calls.filter(call =>
        call[0].includes('CREATE TABLE IF NOT EXISTS')
      );
      expect(ifNotExistsCalls.length).toBeGreaterThan(0);
    });

    it('should create password reset tokens table', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await initializeDatabase();

      const createTokensCalls = mockQuery.mock.calls.filter(call =>
        call[0].includes('password_reset_tokens') && call[0].includes('CREATE TABLE')
      );
      expect(createTokensCalls.length).toBeGreaterThan(0);
    });

    it('should create email verification tokens table', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await initializeDatabase();

      const createEmailTokensCalls = mockQuery.mock.calls.filter(call =>
        call[0].includes('email_verification_tokens') && call[0].includes('CREATE TABLE')
      );
      expect(createEmailTokensCalls.length).toBeGreaterThan(0);
    });

    it('should create class_user junction table', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await initializeDatabase();

      const createClassUserCalls = mockQuery.mock.calls.filter(call =>
        call[0].includes('class_user') && call[0].includes('CREATE TABLE')
      );
      expect(createClassUserCalls.length).toBeGreaterThan(0);
    });

    it('should create comments table', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await initializeDatabase();

      const createCommentsCalls = mockQuery.mock.calls.filter(call =>
        call[0].includes('comments') && call[0].includes('CREATE TABLE')
      );
      expect(createCommentsCalls.length).toBeGreaterThan(0);
    });
  });
});
