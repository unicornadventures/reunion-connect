import { seedAdminUser } from '../seed';
import bcrypt from 'bcryptjs';

// Mock the database module
jest.mock('../db', () => ({
  query: jest.fn()
}));

describe('Seed Utilities', () => {
  let mockQuery: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    const db = require('../db');
    mockQuery = db.query;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('seedAdminUser', () => {
    it('should create admin user when none exists', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Check existing user - none found
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // INSERT user
        .mockResolvedValueOnce({ rows: [] }) // INSERT profile
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await seedAdminUser('TestPassword123!');

      expect(mockQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockQuery).toHaveBeenCalledWith('SELECT id FROM users WHERE email = $1', ['admin@reunion.com']);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining(['admin@reunion.com'])
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO profiles'),
        expect.arrayContaining([1, 'Admin', 'Administrator'])
      );
      expect(mockQuery).toHaveBeenCalledWith('COMMIT');
    });

    it('should skip creation if admin user already exists', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Check existing user - found
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await seedAdminUser('TestPassword123!');

      expect(mockQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockQuery).toHaveBeenCalledWith('SELECT id FROM users WHERE email = $1', ['admin@reunion.com']);
      expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
      // Verify INSERT was NOT called
      expect(mockQuery).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.anything()
      );
    });

    it('should rollback on error during user creation', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Check existing user
        .mockRejectedValueOnce(new Error('Database error')) // INSERT user fails
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(seedAdminUser('TestPassword123!')).rejects.toThrow('Database error');

      expect(mockQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should rollback on error during profile creation', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Check existing user
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // INSERT user
        .mockRejectedValueOnce(new Error('Profile insert failed')) // INSERT profile fails
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(seedAdminUser('TestPassword123!')).rejects.toThrow('Profile insert failed');

      expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should hash the password before storing', async () => {
      const password = 'TestPassword123!';
      let capturedHashedPassword: string = '';

      mockQuery.mockImplementation((sql: string, params?: any[]) => {
        if (sql.includes('INSERT INTO users')) {
          capturedHashedPassword = params?.[1] || '';
        }
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('SELECT id FROM users')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('INSERT INTO users')) {
          return Promise.resolve({ rows: [{ id: 1 }] });
        }
        if (sql.includes('INSERT INTO profiles')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      await seedAdminUser(password);

      // Verify password was hashed (bcrypt hashes are never plain text)
      expect(capturedHashedPassword).not.toBe(password);
      expect(capturedHashedPassword).toHaveLength(60); // bcrypt hash is always 60 chars
    });

    it('should create profile with correct admin name', async () => {
      let profileParams: any[] = [];

      mockQuery.mockImplementation((sql: string, params?: any[]) => {
        if (sql.includes('INSERT INTO profiles')) {
          profileParams = params || [];
        }
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('SELECT id FROM users')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('INSERT INTO users')) {
          return Promise.resolve({ rows: [{ id: 5 }] });
        }
        if (sql.includes('INSERT INTO profiles')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      await seedAdminUser('TestPassword123!');

      expect(profileParams[0]).toBe(5); // user_id
      expect(profileParams[1]).toBe('Admin'); // first_name
      expect(profileParams[2]).toBe('Administrator'); // last_name
    });

    it('should use correct email for admin user', async () => {
      let userParams: any[] = [];

      mockQuery.mockImplementation((sql: string, params?: any[]) => {
        if (sql.includes('INSERT INTO users')) {
          userParams = params || [];
        }
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('SELECT id FROM users')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('INSERT INTO users')) {
          return Promise.resolve({ rows: [{ id: 1 }] });
        }
        if (sql.includes('INSERT INTO profiles')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      await seedAdminUser('TestPassword123!');

      expect(userParams[0]).toBe('admin@reunion.com');
      expect(userParams[2]).toBe(true); // is_admin flag
    });

    it('should handle connection errors gracefully', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(seedAdminUser('TestPassword123!')).rejects.toThrow('Connection failed');
    });
  });
});
