import express, { Express } from 'express';
import request from 'supertest';

const mockDb = {
  users: [
    { id: 1, email: 'admin@example.com', password: 'hashed_pass', is_admin: true, created_at: new Date() },
    { id: 2, email: 'user1@example.com', password: 'hashed_pass', is_admin: false, created_at: new Date() },
    { id: 3, email: 'user2@example.com', password: 'hashed_pass', is_admin: false, created_at: new Date() }
  ],
  profiles: [
    { id: 1, user_id: 1, first_name: 'Admin', last_name: 'User' },
    { id: 2, user_id: 2, first_name: 'John', last_name: 'Doe' },
    { id: 3, user_id: 3, first_name: 'Jane', last_name: 'Smith' }
  ],
  classes: [
    { id: 1, school_id: 1, year: 2020 }
  ],
  classUsers: [
    { id: 1, class_id: 1, user_id: 1 },
    { id: 2, class_id: 1, user_id: 2 },
    { id: 3, class_id: 1, user_id: 3 }
  ]
};

jest.mock('../../db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    // GET all users
    if (sql.includes('SELECT') && sql.includes('FROM users u') && !sql.includes('WHERE')) {
      return {
        rows: mockDb.users.map((u, idx) => ({
          id: u.id,
          email: u.email,
          is_admin: u.is_admin,
          created_at: u.created_at,
          first_name: mockDb.profiles[idx]?.first_name,
          last_name: mockDb.profiles[idx]?.last_name
        }))
      };
    }

    // SELECT user by id
    if (sql.includes('SELECT id FROM users WHERE id')) {
      const userId = parseInt(params?.[0]);
      const user = mockDb.users.find(u => u.id === userId);
      return { rows: user ? [{ id: user.id }] : [] };
    }

    // DELETE user
    if (sql.includes('DELETE FROM users WHERE id')) {
      const userId = parseInt(params?.[0]);
      mockDb.users = mockDb.users.filter(u => u.id !== userId);
      return { rows: [] };
    }

    // GET paginated class users
    if (sql.includes('SELECT COUNT(*) as count FROM class_user cu')) {
      const classId = parseInt(params?.[0]);
      const count = mockDb.classUsers.filter(cu => cu.class_id === classId).length;
      return { rows: [{ count }] };
    }

    if (sql.includes('SELECT u.id, u.email, p.first_name, p.last_name') && sql.includes('FROM class_user cu')) {
      const classId = parseInt(params?.[0]);
      const users = mockDb.classUsers
        .filter(cu => cu.class_id === classId)
        .map(cu => {
          const user = mockDb.users.find(u => u.id === cu.user_id);
          const profile = mockDb.profiles.find(p => p.user_id === cu.user_id);
          return user && profile ? {
            id: user.id,
            email: user.email,
            first_name: profile.first_name,
            last_name: profile.last_name
          } : null;
        })
        .filter(Boolean);
      return { rows: users };
    }

    return { rows: [] };
  })
}));

jest.mock('../../seed', () => ({
  seedAdminUser: jest.fn(async (password: string) => {
    // Mock successful admin seeding
    return Promise.resolve();
  })
}));

import { adminRoutes } from '../adminRoutes';

describe('Admin Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
    jest.clearAllMocks();
    // Reset mock data
    mockDb.users = [
      { id: 1, email: 'admin@example.com', password: 'hashed_pass', is_admin: true, created_at: new Date() },
      { id: 2, email: 'user1@example.com', password: 'hashed_pass', is_admin: false, created_at: new Date() },
      { id: 3, email: 'user2@example.com', password: 'hashed_pass', is_admin: false, created_at: new Date() }
    ];
  });

  describe('POST /api/admin/seed', () => {
    it('should seed admin user with valid password', async () => {
      const response = await request(app)
        .post('/api/admin/seed')
        .send({
          password: 'AdminPassword123!'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('successfully');
    });

    it('should reject seed with missing password', async () => {
      const response = await request(app)
        .post('/api/admin/seed')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('password');
    });

    it('should handle error during seeding', async () => {
      const { seedAdminUser } = require('../../seed');
      seedAdminUser.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/admin/seed')
        .send({
          password: 'AdminPassword123!'
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Failed to seed');
    });
  });

  describe('GET /api/admin/users', () => {
    it('should return all users', async () => {
      const response = await request(app).get('/api/admin/users');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.users.length).toBeGreaterThan(0);
    });

    it('should include user details', async () => {
      const response = await request(app).get('/api/admin/users');

      expect(response.status).toBe(200);
      const user = response.body.users[0];
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('is_admin');
      expect(user).toHaveProperty('first_name');
      expect(user).toHaveProperty('last_name');
    });

    it('should handle database error', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/admin/users');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/admin/users/:userId', () => {
    it('should delete user successfully', async () => {
      const response = await request(app).delete('/api/admin/users/2');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('deleted');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app).delete('/api/admin/users/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error during deletion', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app).delete('/api/admin/users/1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/admin/classes/:classId/users', () => {
    it('should return paginated users for a class', async () => {
      const response = await request(app).get('/api/admin/classes/1/users');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('pageSize');
    });

    it('should return users with correct fields', async () => {
      const response = await request(app).get('/api/admin/classes/1/users');

      expect(response.status).toBe(200);
      if (response.body.users.length > 0) {
        const user = response.body.users[0];
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('first_name');
        expect(user).toHaveProperty('last_name');
      }
    });

    it('should support pagination with page parameter', async () => {
      const response = await request(app)
        .get('/api/admin/classes/1/users')
        .query({ page: 2, pageSize: 2 });

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(2);
      expect(response.body.pageSize).toBe(2);
    });

    it('should filter users by last name', async () => {
      const response = await request(app)
        .get('/api/admin/classes/1/users')
        .query({ lastName: 'Doe' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
    });

    it('should return empty users for non-existent class', async () => {
      const response = await request(app).get('/api/admin/classes/999/users');

      expect(response.status).toBe(200);
      expect(response.body.users.length).toBe(0);
      expect(response.body.total).toBe(0);
    });

    it('should handle database error', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/admin/classes/1/users');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
});
