import express, { Express } from 'express';
import request from 'supertest';

const mockDb = {
  classes: [
    { id: 1, school_id: 1, year: 2020, created_at: new Date(), updated_at: new Date() },
    { id: 2, school_id: 1, year: 2021, created_at: new Date(), updated_at: new Date() }
  ],
  schools: [
    { id: 1, name: 'Test School', location: 'Test City' }
  ]
};

jest.mock('../../db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    // SELECT all classes
    if (sql.includes('SELECT') && sql.includes('FROM classes') && !sql.includes('WHERE')) {
      return {
        rows: mockDb.classes.map(c => ({
          ...c,
          school_name: mockDb.schools.find(s => s.id === c.school_id)?.name
        }))
      };
    }

    // SELECT single class
    if (sql.includes('SELECT') && sql.includes('FROM classes') && sql.includes('WHERE')) {
      const classId = parseInt(params?.[0]);
      const cls = mockDb.classes.find(c => c.id === classId);
      if (cls) {
        return {
          rows: [{
            ...cls,
            school_name: mockDb.schools.find(s => s.id === cls.school_id)?.name
          }]
        };
      }
      return { rows: [] };
    }

    // CHECK if school exists
    if (sql.includes('SELECT id FROM schools')) {
      const schoolId = parseInt(params?.[0]);
      const school = mockDb.schools.find(s => s.id === schoolId);
      return { rows: school ? [{ id: school.id }] : [] };
    }

    // INSERT class
    if (sql.includes('INSERT INTO classes')) {
      const newClass = {
        id: mockDb.classes.length + 1,
        school_id: params?.[0],
        year: params?.[1],
        created_at: new Date(),
        updated_at: new Date()
      };
      mockDb.classes.push(newClass);
      return { rows: [newClass] };
    }

    // UPDATE class
    if (sql.includes('UPDATE classes')) {
      const classId = parseInt(params?.[params.length - 1]);
      const cls = mockDb.classes.find(c => c.id === classId);
      if (cls) {
        cls.school_id = params?.[0];
        cls.year = params?.[1];
        cls.updated_at = new Date();
        return { rows: [cls] };
      }
      return { rows: [] };
    }

    // DELETE class
    if (sql.includes('DELETE FROM classes') && sql.includes('WHERE id')) {
      const classId = parseInt(params?.[0]);
      const index = mockDb.classes.findIndex(c => c.id === classId);
      if (index > -1) {
        const deleted = mockDb.classes.splice(index, 1);
        if (sql.includes('RETURNING')) {
          return { rows: deleted };
        }
      }
      return { rows: [] };
    }

    // DELETE cascades
    if (sql.includes('DELETE FROM class_user')) {
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

import { adminClassRoutes } from '../adminClassRoutes';

describe('Admin Class Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminClassRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/admin/classes', () => {
    it('should return all classes', async () => {
      const response = await request(app).get('/api/admin/classes');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('classes');
      expect(Array.isArray(response.body.classes)).toBe(true);
    });

    it('should return classes with required fields', async () => {
      const response = await request(app).get('/api/admin/classes');

      expect(response.status).toBe(200);
      if (response.body.classes.length > 0) {
        const cls = response.body.classes[0];
        expect(cls).toHaveProperty('id');
        expect(cls).toHaveProperty('year');
        expect(cls).toHaveProperty('school_id');
      }
    });
  });

  describe('POST /api/admin/classes', () => {
    it('should create a new class', async () => {
      const response = await request(app)
        .post('/api/admin/classes')
        .send({
          school_id: 1,
          year: 2022
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('class');
    });

    it('should reject creation with missing school', async () => {
      const response = await request(app)
        .post('/api/admin/classes')
        .send({
          school_id: 999,
          year: 2022
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/admin/classes/:id', () => {
    it('should update a class', async () => {
      const response = await request(app)
        .put('/api/admin/classes/1')
        .send({
          school_id: 1,
          year: 2023
        });

      expect([200, 201]).toContain(response.status);
    });
  });

  describe('DELETE /api/admin/classes/:id', () => {
    it('should delete a class', async () => {
      const response = await request(app)
        .delete('/api/admin/classes/2');

      expect([200, 204]).toContain(response.status);
    });
  });
});
