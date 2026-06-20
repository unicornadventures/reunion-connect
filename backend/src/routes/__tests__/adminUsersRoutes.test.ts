import express, { Express } from 'express';
import request from 'supertest';

const mockDb = {
  users: [
    { id: 1, email: 'user1@example.com', is_admin: false, created_at: new Date() },
    { id: 2, email: 'user2@example.com', is_admin: false, created_at: new Date() },
    { id: 3, email: 'user3@example.com', is_admin: false, created_at: new Date() }
  ],
  profiles: [
    { id: 1, user_id: 1, first_name: 'John', last_name: 'Doe' },
    { id: 2, user_id: 2, first_name: 'Jane', last_name: 'Smith' },
    { id: 3, user_id: 3, first_name: 'Bob', last_name: 'Johnson' }
  ],
  classUsers: [
    { id: 1, class_id: 1, user_id: 1 },
    { id: 2, class_id: 1, user_id: 2 },
    { id: 3, class_id: 1, user_id: 3 }
  ]
};

jest.mock('../../db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    // SELECT all users with profiles (LEFT JOIN)
    if (sql.includes('FROM users u') && sql.includes('LEFT JOIN profiles')) {
      return {
        rows: mockDb.users.map(u => ({
          id: u.id,
          email: u.email,
          is_admin: u.is_admin,
          created_at: u.created_at,
          first_name: mockDb.profiles.find(p => p.user_id === u.id)?.first_name,
          last_name: mockDb.profiles.find(p => p.user_id === u.id)?.last_name
        }))
      };
    }

    // SELECT all users (simple query)
    if (sql.includes('SELECT u.id, u.email, u.is_admin') && !sql.includes('WHERE') && !sql.includes('LEFT JOIN')) {
      return {
        rows: mockDb.users.map(u => ({
          id: u.id,
          email: u.email,
          is_admin: u.is_admin,
          created_at: u.created_at,
          first_name: mockDb.profiles.find(p => p.user_id === u.id)?.first_name,
          last_name: mockDb.profiles.find(p => p.user_id === u.id)?.last_name
        }))
      };
    }

    // COUNT users in class
    if (sql.includes('SELECT COUNT(*)') && sql.includes('class_user')) {
      const classId = parseInt(params?.[0]);
      let count = mockDb.classUsers.filter(cu => cu.class_id === classId).length;

      // Handle WHERE clause with lastName filter
      if (params.length > 1 && params?.[1]) {
        const searchTerm = String(params?.[1]).replace('%', '').toLowerCase();
        const filtered = mockDb.classUsers
          .filter(cu => cu.class_id === classId)
          .map(cu => mockDb.users.find(u => u.id === cu.user_id))
          .filter(Boolean) as any[];
        count = filtered.filter(u => {
          const profile = mockDb.profiles.find(p => p.user_id === u.id);
          return profile?.last_name.toLowerCase().includes(searchTerm);
        }).length;
      }

      return { rows: [{ count: count.toString() }] };
    }

    // SELECT users in class with pagination
    if (sql.includes('SELECT u.id, u.email') && sql.includes('class_user')) {
      const classId = parseInt(params?.[0]);
      let users = mockDb.classUsers
        .filter(cu => cu.class_id === classId)
        .map(cu => mockDb.users.find(u => u.id === cu.user_id))
        .filter(Boolean) as any[];

      // Handle search by last name (second param if present)
      if (params.length > 1 && params?.[1]) {
        const searchTerm = String(params?.[1]).replace('%', '').toLowerCase();
        users = users.filter(u => {
          const profile = mockDb.profiles.find(p => p.user_id === u.id);
          return profile?.last_name.toLowerCase().includes(searchTerm);
        });
      }

      // Sort by last name, then first name
      users.sort((a, b) => {
        const profileA = mockDb.profiles.find(p => p.user_id === a.id);
        const profileB = mockDb.profiles.find(p => p.user_id === b.id);
        const lastNameCmp = (profileA?.last_name || '').localeCompare(profileB?.last_name || '');
        if (lastNameCmp !== 0) return lastNameCmp;
        return (profileA?.first_name || '').localeCompare(profileB?.first_name || '');
      });

      return {
        rows: users.map(u => ({
          id: u.id,
          email: u.email,
          first_name: mockDb.profiles.find(p => p.user_id === u.id)?.first_name,
          last_name: mockDb.profiles.find(p => p.user_id === u.id)?.last_name
        }))
      };
    }

    // CHECK if user exists
    if (sql.includes('SELECT id FROM users WHERE id')) {
      const userId = parseInt(params?.[0]);
      const user = mockDb.users.find(u => u.id === userId);
      return { rows: user ? [{ id: user.id }] : [] };
    }

    // DELETE user
    if (sql.includes('DELETE FROM users') && sql.includes('WHERE id')) {
      const userId = parseInt(params?.[0]);
      const index = mockDb.users.findIndex(u => u.id === userId);
      if (index > -1) {
        const deleted = mockDb.users.splice(index, 1);
        if (sql.includes('RETURNING')) {
          return { rows: deleted };
        }
      }
      return { rows: [] };
    }

    // DELETE cascade - class_user entries
    if (sql.includes('DELETE FROM class_user') && sql.includes('WHERE user_id')) {
      const userId = parseInt(params?.[0]);
      mockDb.classUsers = mockDb.classUsers.filter(cu => cu.user_id !== userId);
      return { rows: [] };
    }

    // DELETE cascade - profile
    if (sql.includes('DELETE FROM profiles') && sql.includes('WHERE user_id')) {
      const userId = parseInt(params?.[0]);
      mockDb.profiles = mockDb.profiles.filter(p => p.user_id !== userId);
      return { rows: [] };
    }

    // SELECT for S3 photo cleanup (if applicable)
    if (sql.includes('SELECT') && sql.includes('then_photo_url')) {
      return { rows: [] };
    }

    // Transaction control
    if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK')) {
      return { rows: [] };
    }

    return { rows: [] };
  })
}));

jest.mock('../../services/emailService', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendVerificationEmail: jest.fn()
}));

jest.mock('../../middleware/adminAuth.ts', () => ({
  requireAdmin: (req: any, res: any, next: any) => {
    req.user = { id: 1, is_admin: true, is_class_admin: false };
    next();
  },
  requireSuperAdmin: (req: any, res: any, next: any) => {
    req.user = { id: 1, is_admin: true, is_class_admin: false };
    next();
  }
}));

import { adminRoutes } from '../adminRoutes';

describe('Admin Users Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/admin/users', () => {
    it('should return all users', async () => {
      const response = await request(app).get('/api/admin/users');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.users.length).toBeGreaterThan(0);
    });

    it('should return users with required fields', async () => {
      const response = await request(app).get('/api/admin/users');

      expect(response.status).toBe(200);
      const user = response.body.users[0];
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('is_admin');
    });
  });

  describe('GET /api/admin/classes/:classId/users', () => {
    it('should return users in a class with pagination', async () => {
      const response = await request(app)
        .get('/api/admin/classes/1/users')
        .query({ page: 1, pageSize: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(Array.isArray(response.body.users)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/admin/classes/1/users')
        .query({ page: 1, pageSize: 2 });

      expect(response.status).toBe(200);
      expect(response.body.users.length).toBeLessThanOrEqual(2);
    });

    it('should support search by last name', async () => {
      const response = await request(app)
        .get('/api/admin/classes/1/users')
        .query({ page: 1, pageSize: 10, lastName: 'Smith' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.users)).toBe(true);
    });
  });

  describe('DELETE /api/admin/users/:userId', () => {
    it('should delete a user', async () => {
      const response = await request(app)
        .delete('/api/admin/users/3');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should cascade delete user data', async () => {
      const response = await request(app)
        .delete('/api/admin/users/2');

      expect(response.status).toBe(200);

      // Verify user is deleted by trying to get it
      const checkResponse = await request(app)
        .get('/api/admin/users');

      const deletedUser = checkResponse.body.users.find((u: any) => u.id === 2);
      expect(deletedUser).toBeUndefined();
    });

    it('should return error for non-existent user', async () => {
      const response = await request(app)
        .delete('/api/admin/users/999');

      expect([400, 404]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    it('should handle database error in POST seed', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .post('/api/admin/seed')
        .send({ password: 'AdminPassword123!' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error in GET users', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/admin/users');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error in GET class users', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .get('/api/admin/classes/1/users')
        .query({ page: 1, pageSize: 10 });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error in DELETE user', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .delete('/api/admin/users/1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
});
