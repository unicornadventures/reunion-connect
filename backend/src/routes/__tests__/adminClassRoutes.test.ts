import express, { Express } from 'express';
import request from 'supertest';

const mockDb = {
  classes: [
    { id: 1, school_id: 1, year: 2020, created_at: new Date(), updated_at: new Date() },
    { id: 2, school_id: 1, year: 2021, created_at: new Date(), updated_at: new Date() },
    { id: 3, school_id: 2, year: 2020, created_at: new Date(), updated_at: new Date() }
  ],
  schools: [
    { id: 1, name: 'Lincoln High', location: 'Lincoln, NE' },
    { id: 2, name: 'Central High', location: 'Central, NE' }
  ],
  classUsers: [] as any[],
  users: [] as any[]
};

jest.mock('../../middleware/adminAuth', () => ({
  requireSuperAdmin: (req: any, res: any, next: any) => {
    req.user = { id: 1, is_admin: true };
    next();
  },
  requireEventAdmin: (req: any, res: any, next: any) => {
    req.user = { id: 1, is_admin: true };
    next();
  },
  requireAdmin: (req: any, res: any, next: any) => {
    req.user = { id: 1, is_admin: true };
    next();
  }
}));

jest.mock('../../db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    // SELECT all classes with JOIN
    if (sql.includes('SELECT c.id, c.year, c.school_id, s.name as school_name') && !sql.includes('WHERE')) {
      const sorted = [...mockDb.classes].sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        const schoolAName = mockDb.schools.find(s => s.id === a.school_id)?.name || '';
        const schoolBName = mockDb.schools.find(s => s.id === b.school_id)?.name || '';
        return schoolAName.localeCompare(schoolBName);
      });
      return {
        rows: sorted.map(c => ({
          id: c.id,
          year: c.year,
          school_id: c.school_id,
          school_name: mockDb.schools.find(s => s.id === c.school_id)?.name,
          created_at: c.created_at,
          updated_at: c.updated_at
        }))
      };
    }

    // SELECT single class by id
    if (sql.includes('SELECT c.id, c.year, c.school_id, s.name as school_name') && sql.includes('WHERE c.id')) {
      const classId = Number(params?.[0]);
      const cls = mockDb.classes.find(c => c.id === classId);
      if (cls) {
        return {
          rows: [{
            id: cls.id,
            year: cls.year,
            school_id: cls.school_id,
            school_name: mockDb.schools.find(s => s.id === cls.school_id)?.name,
            created_at: cls.created_at,
            updated_at: cls.updated_at
          }]
        };
      }
      return { rows: [] };
    }

    // Check if school exists
    if (sql.includes('SELECT id FROM schools WHERE id')) {
      const schoolId = Number(params?.[0]);
      const school = mockDb.schools.find(s => s.id === schoolId);
      return { rows: school ? [{ id: school.id }] : [] };
    }

    // INSERT INTO classes
    if (sql.includes('INSERT INTO classes')) {
      const newClass = {
        id: Math.max(...mockDb.classes.map(c => c.id), 0) + 1,
        school_id: Number(params?.[0]),
        year: Number(params?.[1]),
        created_at: new Date(),
        updated_at: new Date()
      };
      mockDb.classes.push(newClass);
      return { rows: [newClass] };
    }

    // UPDATE classes
    if (sql.includes('UPDATE classes SET')) {
      const classId = Number(params?.[params.length - 1]);
      const cls = mockDb.classes.find(c => c.id === classId);
      if (cls) {
        cls.school_id = Number(params?.[0]);
        cls.year = Number(params?.[1]);
        cls.updated_at = new Date();
        return { rows: [{ ...cls }] };
      }
      return { rows: [] };
    }

    // SELECT users in class (for cascading delete)
    if (sql.includes('SELECT DISTINCT user_id as id') && sql.includes('FROM class_user')) {
      const classId = Number(params?.[0]);
      const users = mockDb.classUsers.filter(cu => cu.class_id === classId).map(cu => ({ id: cu.user_id }));
      return { rows: users };
    }

    // DELETE users (cascading)
    if (sql.includes('DELETE FROM users') && sql.includes('WHERE id IN')) {
      return { rows: [] };
    }

    // DELETE class
    if (sql.includes('DELETE FROM classes WHERE id')) {
      const classId = Number(params?.[0]);
      const cls = mockDb.classes.find(c => c.id === classId);
      if (cls) {
        const index = mockDb.classes.findIndex(c => c.id === classId);
        mockDb.classes.splice(index, 1);
        return { rows: [{ ...cls }] };
      }
      return { rows: [] };
    }

    // Transaction control
    if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK')) {
      return { rows: [] };
    }

    return { rows: [] };
  })
}));

jest.mock('../../s3Service', () => ({
  deleteUserPhotosFromS3: jest.fn(async () => {})
}));

jest.mock('../../services/emailService', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendVerificationEmail: jest.fn()
}));

import { adminClassRoutes } from '../adminClassRoutes';

describe('Admin Class Routes', () => {
  let app: Express;

  beforeEach(() => {
    mockDb.classes = [
      { id: 1, school_id: 1, year: 2020, created_at: new Date(), updated_at: new Date() },
      { id: 2, school_id: 1, year: 2021, created_at: new Date(), updated_at: new Date() },
      { id: 3, school_id: 2, year: 2020, created_at: new Date(), updated_at: new Date() }
    ];

    app = express();
    app.use(express.json());
    app.use('/api/admin/classes', adminClassRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/admin/classes', () => {
    it('should return all classes', async () => {
      const response = await request(app).get('/api/admin/classes');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('classes');
      expect(Array.isArray(response.body.classes)).toBe(true);
      expect(response.body.classes.length).toBeGreaterThan(0);
    });

    it('should return classes with required fields', async () => {
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
      if (response.body.classes.length > 1) {
        for (let i = 0; i < response.body.classes.length - 1; i++) {
          expect(response.body.classes[i].year).toBeGreaterThanOrEqual(response.body.classes[i + 1].year);
        }
      }
    });
  });

  describe('GET /api/admin/classes/:id', () => {
    it('should return a single class by id', async () => {
      const response = await request(app).get('/api/admin/classes/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('class');
      expect(response.body.class.id).toBe(1);
    });

    it('should return class with all required fields', async () => {
      const response = await request(app).get('/api/admin/classes/1');

      expect(response.status).toBe(200);
      const cls = response.body.class;
      expect(cls).toHaveProperty('id');
      expect(cls).toHaveProperty('year');
      expect(cls).toHaveProperty('school_id');
      expect(cls).toHaveProperty('school_name');
    });

    it('should return 404 for non-existent class', async () => {
      const response = await request(app).get('/api/admin/classes/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
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
      expect(response.body.class.school_id).toBe(1);
      expect(response.body.class.year).toBe(2022);
    });

    it('should reject creation without school_id', async () => {
      const response = await request(app)
        .post('/api/admin/classes')
        .send({
          year: 2022
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject creation without year', async () => {
      const response = await request(app)
        .post('/api/admin/classes')
        .send({
          school_id: 1
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject creation with non-existent school', async () => {
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
          school_id: 2,
          year: 2023
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('class');
      expect(response.body.class.year).toBe(2023);
    });

    it('should reject update without school_id', async () => {
      const response = await request(app)
        .put('/api/admin/classes/1')
        .send({
          year: 2023
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject update without year', async () => {
      const response = await request(app)
        .put('/api/admin/classes/1')
        .send({
          school_id: 1
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject update with non-existent school', async () => {
      const response = await request(app)
        .put('/api/admin/classes/1')
        .send({
          school_id: 999,
          year: 2023
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent class', async () => {
      const response = await request(app)
        .put('/api/admin/classes/999')
        .send({
          school_id: 1,
          year: 2023
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/admin/classes/:id', () => {
    it('should delete a class', async () => {
      const response = await request(app)
        .delete('/api/admin/classes/2');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should return 404 for non-existent class', async () => {
      const response = await request(app)
        .delete('/api/admin/classes/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should delete with cascadeUsers query parameter', async () => {
      const response = await request(app)
        .delete('/api/admin/classes/3?cascadeUsers=true');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Error Handling', () => {
    it('should handle database error in GET all classes', async () => {
      const { query } = require('../../db');
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/admin/classes');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error in GET single class', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/admin/classes/1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error in POST after validation', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      const mockQuery = jest.fn();
      query.mockImplementation(mockQuery);

      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // school exists check passes
      mockQuery.mockRejectedValueOnce(new Error('Database error')); // INSERT fails

      const response = await request(app)
        .post('/api/admin/classes')
        .send({
          school_id: 1,
          year: 2024
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error in PUT after validation', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      const mockQuery = jest.fn();
      query.mockImplementation(mockQuery);

      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // school exists check passes
      mockQuery.mockRejectedValueOnce(new Error('Database error')); // UPDATE fails

      const response = await request(app)
        .put('/api/admin/classes/1')
        .send({
          school_id: 1,
          year: 2024
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error in DELETE', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .delete('/api/admin/classes/1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
});
