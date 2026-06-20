import express, { Express } from 'express';
import request from 'supertest';

// Mock database
const mockDb = {
  classes: [
    { id: 1, school_id: 1, year: 2020, school_name: 'Test School', created_at: new Date(), updated_at: new Date() },
    { id: 2, school_id: 1, year: 2021, school_name: 'Test School', created_at: new Date(), updated_at: new Date() }
  ],
  users: [
    { id: 1, email: 'user1@example.com', first_name: 'John', last_name: 'Doe' },
    { id: 2, email: 'user2@example.com', first_name: 'Jane', last_name: 'Smith' }
  ],
  classUsers: [
    { id: 1, class_id: 1, user_id: 1 },
    { id: 2, class_id: 1, user_id: 2 }
  ]
};

jest.mock('../../db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    if (sql.includes('SELECT c.id, c.year, c.school_id, s.name')) {
      return { rows: mockDb.classes };
    }

    if (sql.includes('SELECT COUNT(*)') && sql.includes('class_user')) {
      return { rows: [{ count: mockDb.classUsers.length }] };
    }

    if (sql.includes('SELECT u.id, u.email') && sql.includes('class_user')) {
      const classId = params?.[0];
      const users = mockDb.classUsers
        .filter(cu => cu.class_id === classId)
        .map(cu => mockDb.users.find(u => u.id === cu.user_id));
      return { rows: users.filter(Boolean) };
    }

    if (sql.includes('SELECT c.id, c.year') && !sql.includes('WHERE')) {
      return { rows: mockDb.classes };
    }

    if (sql.includes('SELECT c.id, c.year, c.school_id') && sql.includes('WHERE c.id')) {
      const classId = params?.[0];
      const cls = mockDb.classes.find(c => c.id === classId);
      return { rows: cls ? [{ ...cls, school_name: cls.school_name }] : [] };
    }

    return { rows: [] };
  })
}));

import { classRoutes } from '../classRoutes';

describe('Class Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/classes', classRoutes);
  });

  describe('GET /api/classes', () => {
    it('should return all classes', async () => {
      const response = await request(app).get('/api/classes');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('classes');
      expect(Array.isArray(response.body.classes)).toBe(true);
      expect(response.body.classes.length).toBeGreaterThan(0);
    });

    it('should return classes with required fields', async () => {
      const response = await request(app).get('/api/classes');

      expect(response.status).toBe(200);
      const firstClass = response.body.classes[0];
      expect(firstClass).toHaveProperty('id');
      expect(firstClass).toHaveProperty('year');
      expect(firstClass).toHaveProperty('school_id');
      expect(firstClass).toHaveProperty('school_name');
    });
  });

  describe('GET /api/classes/:id', () => {
    it('should return a specific class', async () => {
      const response = await request(app).get('/api/classes/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('class');
      expect(response.body.class.id).toBe(1);
      expect(response.body.class.year).toBe(2020);
    });

    it('should return 404 for non-existent class', async () => {
      const response = await request(app).get('/api/classes/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/classes/:id/members', () => {
    it('should return members of a class', async () => {
      const response = await request(app).get('/api/classes/1/members');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('members');
      expect(Array.isArray(response.body.members)).toBe(true);
    });

    it('should return members with user info', async () => {
      const response = await request(app).get('/api/classes/1/members');

      expect(response.status).toBe(200);
      const member = response.body.members[0];
      expect(member).toHaveProperty('id');
      expect(member).toHaveProperty('email');
      expect(member).toHaveProperty('first_name');
    });
  });

  describe('GET /api/classes/:id/alumni-count', () => {
    it('should return alumni count for a class', async () => {
      const response = await request(app).get('/api/classes/1/alumni-count');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('count');
      expect(typeof response.body.count).toBe('number');
    });
  });
});
