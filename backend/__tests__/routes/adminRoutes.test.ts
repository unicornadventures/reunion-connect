import request from 'supertest';
import express from 'express';
import { adminRoutes } from '../../src/routes/adminRoutes';
import { query } from '../../src/db';
import * as seedModule from '../../src/seed';

jest.mock('../../src/db');
jest.mock('../../src/seed');

const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);

describe('Admin Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/admin/seed', () => {
    it('should return 400 if password is missing', async () => {
      const res = await request(app).post('/api/admin/seed').send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing required field: password.');
    });

    it('should successfully seed admin user with valid password', async () => {
      (seedModule.seedAdminUser as jest.Mock).mockResolvedValueOnce(undefined);

      const res = await request(app).post('/api/admin/seed').send({
        password: 'secureAdminPassword123'
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Admin user seeding completed successfully.');
      expect(seedModule.seedAdminUser).toHaveBeenCalledWith('secureAdminPassword123');
    });

    it('should handle seeding errors', async () => {
      (seedModule.seedAdminUser as jest.Mock).mockRejectedValueOnce(
        new Error('Admin user already exists')
      );

      const res = await request(app).post('/api/admin/seed').send({
        password: 'secureAdminPassword123'
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Failed to seed admin user');
      expect(res.body.error).toContain('Admin user already exists');
    });

    it('should handle other seeding errors', async () => {
      (seedModule.seedAdminUser as jest.Mock).mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const res = await request(app).post('/api/admin/seed').send({
        password: 'testPassword'
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Failed to seed admin user');
      expect(res.body.error).toContain('Database connection failed');
    });
  });

  describe('GET /api/admin/users', () => {
    it('should return an empty list of users', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/admin/users');

      expect(res.status).toBe(200);
      expect(res.body.users).toEqual([]);
    });

    it('should return a list of all users with their profiles', async () => {
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            email: 'admin@example.com',
            is_admin: true,
            created_at: new Date().toISOString(),
            first_name: 'Admin',
            last_name: 'User'
          },
          {
            id: 2,
            email: 'john@example.com',
            is_admin: false,
            created_at: new Date().toISOString(),
            first_name: 'John',
            last_name: 'Doe'
          },
          {
            id: 3,
            email: 'jane@example.com',
            is_admin: false,
            created_at: new Date().toISOString(),
            first_name: 'Jane',
            last_name: null
          }
        ]
      });

      const res = await request(app).get('/api/admin/users');

      expect(res.status).toBe(200);
      expect(res.body.users).toHaveLength(3);
      expect(res.body.users[0].email).toBe('admin@example.com');
      expect(res.body.users[0].is_admin).toBe(true);
      expect(res.body.users[1].first_name).toBe('John');
      expect(res.body.users[2].last_name).toBeNull();
    });

    it('should return users ordered by created_at descending', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      (query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 2,
            email: 'newer@example.com',
            is_admin: false,
            created_at: now.toISOString(),
            first_name: 'Newer',
            last_name: 'User'
          },
          {
            id: 1,
            email: 'older@example.com',
            is_admin: false,
            created_at: yesterday.toISOString(),
            first_name: 'Older',
            last_name: 'User'
          }
        ]
      });

      const res = await request(app).get('/api/admin/users');

      expect(res.status).toBe(200);
      expect(res.body.users).toHaveLength(2);
      expect(res.body.users[0].email).toBe('newer@example.com');
      expect(res.body.users[1].email).toBe('older@example.com');
    });

    it('should handle server errors', async () => {
      (query as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/admin/users');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal server error while fetching user list.');
    });

    it('should handle users with missing profile data', async () => {
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            email: 'noprofile@example.com',
            is_admin: false,
            created_at: new Date().toISOString(),
            first_name: null,
            last_name: null
          }
        ]
      });

      const res = await request(app).get('/api/admin/users');

      expect(res.status).toBe(200);
      expect(res.body.users).toHaveLength(1);
      expect(res.body.users[0].first_name).toBeNull();
      expect(res.body.users[0].last_name).toBeNull();
    });
  });
});
