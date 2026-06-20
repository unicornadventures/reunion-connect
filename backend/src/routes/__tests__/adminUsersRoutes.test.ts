import express, { Express } from 'express';
import request from 'supertest';

// Mock database
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
    if (sql.includes('SELECT u.id, u.email, u.is_admin') && !sql.includes('WHERE')) {
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

    if (sql.includes('SELECT COUNT(*)') && sql.includes('class_user')) {
      const classId = params?.[0];
      const count = mockDb.classUsers.filter(cu => cu.class_id === classId).length;
      return { rows: [{ count }] };
    }

    if (sql.includes('SELECT u.id, u.email') && sql.includes('class_user')) {
      const classId = params?.[0];
      const lastName = params?.[1];
      let users = mockDb.classUsers
        .filter(cu => cu.class_id === classId)
        .map(cu => mockDb.users.find(u => u.id === cu.user_id))
        .filter(Boolean) as any[];

      if (lastName) {
        const searchTerm = lastName.replace('%', '').toLowerCase();
        users = users.filter(u => {
          const profile = mockDb.profiles.find(p => p.user_id === u.id);
          return profile?.last_name.toLowerCase().includes(searchTerm);
        });
      }

      const page = 1;
      const pageSize = 10;
      const total = users.length;
      const start = (page - 1) * pageSize;
      const paginated = users.slice(start, start + pageSize);

      return {
        rows: paginated.map(u => ({
          id: u.id,
          email: u.email,
          first_name: mockDb.profiles.find(p => p.user_id === u.id)?.first_name,
          last_name: mockDb.profiles.find(p => p.user_id === u.id)?.last_name
        })),
        total,
        page,
        pageSize
      };
    }

    if (sql.includes('SELECT id FROM users WHERE id')) {
      const userId = params?.[0];
      const user = mockDb.users.find(u => u.id === userId);
      return { rows: user ? [{ id: user.id }] : [] };
    }

    if (sql.includes('DELETE FROM users')) {
      const userId = params?.[0];
      const index = mockDb.users.findIndex(u => u.id === userId);
      if (index > -1) {
        mockDb.users.splice(index, 1);
      }
      return { rows: [] };
    }

    if (sql.includes('DELETE FROM class_user') && sql.includes('user_id')) {
      const userId = params?.[0];
      mockDb.classUsers = mockDb.classUsers.filter(cu => cu.user_id !== userId);
      return { rows: [] };
    }

    return { rows: [] };
  })
}));

jest.mock('../../services/emailService', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendVerificationEmail: jest.fn()
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
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('pageSize');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/admin/classes/1/users')
        .query({ page: 1, pageSize: 2 });

      expect(response.status).toBe(200);
      expect(response.body.pageSize).toBe(2);
    });

    it('should support last name search', async () => {
      const response = await request(app)
        .get('/api/admin/classes/1/users')
        .query({ page: 1, pageSize: 10, lastName: 'Doe' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
    });

    it('should return empty results for non-matching search', async () => {
      const response = await request(app)
        .get('/api/admin/classes/1/users')
        .query({ page: 1, pageSize: 10, lastName: 'NonExistent' });

      expect(response.status).toBe(200);
      expect(response.body.users.length).toBe(0);
    });

    it('should return 0 total when no users match', async () => {
      const response = await request(app)
        .get('/api/admin/classes/1/users')
        .query({ page: 1, pageSize: 10, lastName: 'XyzAbc' });

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(0);
    });
  });

  describe('DELETE /api/admin/users/:userId', () => {
    it('should delete a user', async () => {
      const response = await request(app)
        .delete('/api/admin/users/3');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .delete('/api/admin/users/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should cascade delete user data', async () => {
      // First delete should remove user
      const response = await request(app)
        .delete('/api/admin/users/2');

      expect(response.status).toBe(200);

      // User should no longer exist
      const checkResponse = await request(app)
        .delete('/api/admin/users/2');

      expect(checkResponse.status).toBe(404);
    });
  });
});
