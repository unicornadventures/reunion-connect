import express, { Express } from 'express';
import request from 'supertest';

// Mock database
const mockDb = {
  classes: [
    { id: 1, school_id: 1, year: 2020, created_at: new Date(), updated_at: new Date() },
    { id: 2, school_id: 1, year: 2021, created_at: new Date(), updated_at: new Date() }
  ],
  schools: [
    { id: 1, name: 'Test School', location: 'Test City' }
  ],
  classUsers: [
    { id: 1, class_id: 1, user_id: 1 },
    { id: 2, class_id: 1, user_id: 2 }
  ]
};

jest.mock('../../db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    if (sql.includes('SELECT id FROM schools WHERE id')) {
      const schoolId = params?.[0];
      const school = mockDb.schools.find(s => s.id === schoolId);
      return { rows: school ? [school] : [] };
    }

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

    if (sql.includes('SELECT c.id, c.year, c.school_id') && !sql.includes('WHERE')) {
      return {
        rows: mockDb.classes.map(c => ({
          ...c,
          school_name: mockDb.schools.find(s => s.id === c.school_id)?.name
        }))
      };
    }

    if (sql.includes('SELECT c.id, c.year, c.school_id') && sql.includes('WHERE c.id')) {
      const classId = params?.[0];
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

    if (sql.includes('UPDATE classes')) {
      const classId = params?.[2];
      const cls = mockDb.classes.find(c => c.id === classId);
      if (cls) {
        cls.school_id = params?.[0];
        cls.year = params?.[1];
        cls.updated_at = new Date();
      }
      return { rows: [] };
    }

    if (sql.includes('DELETE FROM class_user') && sql.includes('class_id')) {
      const classId = params?.[0];
      mockDb.classUsers = mockDb.classUsers.filter(cu => cu.class_id !== classId);
      return { rows: [] };
    }

    if (sql.includes('DELETE FROM classes')) {
      const classId = params?.[0];
      const index = mockDb.classes.findIndex(c => c.id === classId);
      if (index > -1) {
        mockDb.classes.splice(index, 1);
      }
      return { rows: [] };
    }

    return { rows: [] };
  })
}));

jest.mock('../../services/emailService', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendVerificationEmail: jest.fn()
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
      expect(response.body.class.year).toBe(2022);
    });

    it('should reject class creation with missing school', async () => {
      const response = await request(app)
        .post('/api/admin/classes')
        .send({
          year: 2022
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject class creation with non-existent school', async () => {
      const response = await request(app)
        .post('/api/admin/classes')
        .send({
          school_id: 999,
          year: 2022
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject class creation with missing year', async () => {
      const response = await request(app)
        .post('/api/admin/classes')
        .send({
          school_id: 1
        });

      expect(response.status).toBe(400);
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

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should reject update with invalid school', async () => {
      const response = await request(app)
        .put('/api/admin/classes/1')
        .send({
          school_id: 999,
          year: 2023
        });

      expect([400, 404]).toContain(response.status);
    });
  });

  describe('DELETE /api/admin/classes/:id', () => {
    it('should delete a class', async () => {
      const response = await request(app)
        .delete('/api/admin/classes/2');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle cascade delete with cascadeUsers flag', async () => {
      const response = await request(app)
        .delete('/api/admin/classes/1?cascadeUsers=true');

      expect(response.status).toBe(200);
    });

    it('should handle deletion without cascadeUsers', async () => {
      const response = await request(app)
        .delete('/api/admin/classes/1?cascadeUsers=false');

      expect(response.status).toBe(200);
    });
  });
});
