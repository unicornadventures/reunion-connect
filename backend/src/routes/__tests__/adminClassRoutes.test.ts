import express, { Express } from 'express';
import request from 'supertest';

const mockDb = {
  classes: [
    { id: 1, year: 2020, created_at: new Date() },
    { id: 2, year: 2021, created_at: new Date() },
    { id: 3, year: 2020, created_at: new Date() }
  ],
  classSchool: [
    { class_id: 1, school_id: 1 },
    { class_id: 2, school_id: 1 },
    { class_id: 3, school_id: 2 }
  ],
  schools: [
    { id: 1, name: 'Lincoln High', location: 'Lincoln, NE' },
    { id: 2, name: 'Central High', location: 'Central, NE' }
  ],
  classUsers: [
    { class_id: 1, user_id: 10, school_id: 1 },
    { class_id: 1, user_id: 11, school_id: 1 }
  ],
  users: [
    { id: 10, email: 'alice@example.com' },
    { id: 11, email: 'bob@example.com' }
  ],
  profiles: [
    { user_id: 10, first_name: 'Alice', last_name: 'A' },
    { user_id: 11, first_name: 'Bob', last_name: 'B' }
  ]
};

jest.mock('../../middleware/adminAuth', () => ({
  requireSuperAdmin: (req: any, res: any, next: any) => {
    req.user = { id: 1, is_admin: true };
    next();
  },
}));

jest.mock('../../db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    // GET all classes with JOIN through class_school
    if (sql.includes('FROM classes c') && sql.includes('JOIN class_school cs') && !sql.includes('WHERE')) {
      return {
        rows: mockDb.classSchool.map(cs => {
          const cls = mockDb.classes.find(c => c.id === cs.class_id)!;
          const school = mockDb.schools.find(s => s.id === cs.school_id)!;
          return { id: cls.id, year: cls.year, school_id: cs.school_id, school_name: school.name, created_at: cls.created_at };
        }).sort((a, b) => b.year - a.year || a.school_name.localeCompare(b.school_name))
      };
    }

    // GET single class by id
    if (sql.includes('FROM classes c') && sql.includes('LEFT JOIN class_school') && sql.includes('WHERE c.id')) {
      const classId = Number(params?.[0]);
      const cls = mockDb.classes.find(c => c.id === classId);
      if (!cls) return { rows: [] };
      const cs = mockDb.classSchool.find(c => c.class_id === classId);
      const school = cs ? mockDb.schools.find(s => s.id === cs.school_id) : null;
      return {
        rows: [{
          id: cls.id, year: cls.year,
          school_id: cs?.school_id || null,
          school_name: school?.name || null,
          created_at: cls.created_at
        }]
      };
    }

    // GET class users
    if (sql.includes('FROM class_user cu') && sql.includes('WHERE cu.class_id')) {
      const classId = Number(params?.[0]);
      const rows = mockDb.classUsers
        .filter(cu => cu.class_id === classId)
        .map(cu => {
          const user = mockDb.users.find(u => u.id === cu.user_id);
          const profile = mockDb.profiles.find(p => p.user_id === cu.user_id);
          return user ? { id: user.id, email: user.email, first_name: profile?.first_name || null, last_name: profile?.last_name || null } : null;
        })
        .filter(Boolean);
      return { rows };
    }

    return { rows: [] };
  })
}));

import { adminClassRoutes } from '../adminClassRoutes';

describe('Admin Class Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/admin/classes', adminClassRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/admin/classes', () => {
    it('should return all classes with school context', async () => {
      const response = await request(app).get('/api/admin/classes');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('classes');
      expect(Array.isArray(response.body.classes)).toBe(true);
      expect(response.body.classes.length).toBeGreaterThan(0);
    });

    it('should return classes with school_id and school_name', async () => {
      const response = await request(app).get('/api/admin/classes');

      expect(response.status).toBe(200);
      const cls = response.body.classes[0];
      expect(cls).toHaveProperty('id');
      expect(cls).toHaveProperty('year');
      expect(cls).toHaveProperty('school_id');
      expect(cls).toHaveProperty('school_name');
    });

    it('should return classes ordered by year DESC', async () => {
      const response = await request(app).get('/api/admin/classes');

      expect(response.status).toBe(200);
      const years = response.body.classes.map((c: any) => c.year);
      for (let i = 0; i < years.length - 1; i++) {
        expect(years[i]).toBeGreaterThanOrEqual(years[i + 1]);
      }
    });

    it('should handle database error', async () => {
      const { query } = require('../../db');
      query.mockImplementationOnce(async () => { throw new Error('Database error'); });

      const response = await request(app).get('/api/admin/classes');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/admin/classes/:id/users', () => {
    it('should return users in a class', async () => {
      const response = await request(app).get('/api/admin/classes/1/users');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(Array.isArray(response.body.users)).toBe(true);
    });

    it('should return user info fields', async () => {
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

    it('should return empty array for class with no users', async () => {
      const response = await request(app).get('/api/admin/classes/999/users');

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(0);
    });

    it('should handle database error', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => { throw new Error('Database error'); });

      const response = await request(app).get('/api/admin/classes/1/users');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/admin/classes/:id', () => {
    it('should return a single class by id', async () => {
      const response = await request(app).get('/api/admin/classes/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('class');
      expect(response.body.class.id).toBe(1);
    });

    it('should return class with year and school context', async () => {
      const response = await request(app).get('/api/admin/classes/1');

      expect(response.status).toBe(200);
      const cls = response.body.class;
      expect(cls).toHaveProperty('id');
      expect(cls).toHaveProperty('year');
    });

    it('should return 404 for non-existent class', async () => {
      const response = await request(app).get('/api/admin/classes/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => { throw new Error('Database error'); });

      const response = await request(app).get('/api/admin/classes/1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
});
