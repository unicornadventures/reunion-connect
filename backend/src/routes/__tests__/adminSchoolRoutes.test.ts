import express, { Express } from 'express';
import request from 'supertest';

const mockDb = {
  schools: [
    { id: 1, name: 'Test School', location: 'Test City', created_at: new Date(), updated_at: new Date() },
    { id: 2, name: 'Another School', location: 'Another City', created_at: new Date(), updated_at: new Date() }
  ]
};

jest.mock('../../db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    // Handle all SELECT queries
    if (sql.includes('SELECT') && sql.includes('schools')) {
      if (!sql.includes('WHERE')) {
        // SELECT all
        return { rows: mockDb.schools };
      } else {
        // SELECT by id
        const schoolId = parseInt(params?.[0]);
        const school = mockDb.schools.find(s => s.id === schoolId);
        return { rows: school ? [school] : [] };
      }
    }

    // INSERT school
    if (sql.includes('INSERT INTO schools')) {
      const school = {
        id: mockDb.schools.length + 1,
        name: params?.[0],
        location: params?.[1] || null,
        created_at: new Date(),
        updated_at: new Date()
      };
      mockDb.schools.push(school);
      return { rows: [school] };
    }

    // UPDATE school
    if (sql.includes('UPDATE schools')) {
      const schoolId = parseInt(params?.[params.length - 1]);
      const school = mockDb.schools.find(s => s.id === schoolId);
      if (school) {
        school.name = params?.[0];
        school.location = params?.[1] || null;
        school.updated_at = new Date();
        return { rows: [school] };
      }
      return { rows: [] };
    }

    // DELETE school
    if (sql.includes('DELETE FROM schools')) {
      const schoolId = parseInt(params?.[0]);
      const index = mockDb.schools.findIndex(s => s.id === schoolId);
      if (index > -1) {
        const deleted = mockDb.schools.splice(index, 1);
        // Return the deleted row if RETURNING is in the query
        if (sql.includes('RETURNING')) {
          return { rows: deleted };
        }
      }
      return { rows: [] };
    }

    // All other queries
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

import { adminSchoolRoutes } from '../adminSchoolRoutes';

describe('Admin School Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminSchoolRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/admin', () => {
    it('should return all schools', async () => {
      const response = await request(app).get('/api/admin');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('schools');
      expect(Array.isArray(response.body.schools)).toBe(true);
      expect(response.body.schools.length).toBeGreaterThan(0);
    });

    it('should return schools with required fields', async () => {
      const response = await request(app).get('/api/admin');

      expect(response.status).toBe(200);
      const school = response.body.schools[0];
      expect(school).toHaveProperty('id');
      expect(school).toHaveProperty('name');
      expect(school).toHaveProperty('location');
    });
  });

  describe('POST /api/admin', () => {
    it('should create a new school', async () => {
      const response = await request(app)
        .post('/api/admin')
        .send({
          name: 'New School',
          location: 'New City'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('school');
      expect(response.body.school.name).toBe('New School');
    });

    it('should reject school creation with missing name', async () => {
      const response = await request(app)
        .post('/api/admin')
        .send({
          location: 'Some City'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/admin/:id', () => {
    it('should update a school', async () => {
      const response = await request(app)
        .put('/api/admin/1')
        .send({
          name: 'Updated School',
          location: 'Updated City'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('school');
      expect(response.body.school.name).toBe('Updated School');
    });

    it('should reject update with missing name', async () => {
      const response = await request(app)
        .put('/api/admin/1')
        .send({
          location: 'Updated City'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/admin/:id', () => {
    it('should delete a school', async () => {
      const response = await request(app)
        .delete('/api/admin/2');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle deletion of non-existent school', async () => {
      const response = await request(app)
        .delete('/api/admin/999');

      expect([200, 404]).toContain(response.status);
    });
  });
});
