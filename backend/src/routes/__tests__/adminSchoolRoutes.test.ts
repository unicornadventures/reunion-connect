import express, { Express } from 'express';
import request from 'supertest';

// Mock database
const mockDb = {
  schools: [
    { id: 1, name: 'Test School', location: 'Test City', created_at: new Date(), updated_at: new Date() },
    { id: 2, name: 'Another School', location: 'Another City', created_at: new Date(), updated_at: new Date() }
  ],
  classes: [
    { id: 1, school_id: 1, year: 2020 },
    { id: 2, school_id: 1, year: 2021 }
  ],
  users: [
    { id: 1, email: 'user1@example.com', school_id: 1 }
  ]
};

jest.mock('../../db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    if (sql.includes('SELECT') && sql.includes('schools') && !sql.includes('WHERE')) {
      return { rows: mockDb.schools };
    }

    if (sql.includes('SELECT') && sql.includes('schools') && sql.includes('WHERE id')) {
      const schoolId = params?.[0];
      const school = mockDb.schools.find(s => s.id === schoolId);
      return { rows: school ? [school] : [] };
    }

    if (sql.includes('INSERT INTO schools')) {
      const school = {
        id: mockDb.schools.length + 1,
        name: params?.[0],
        location: params?.[1],
        created_at: new Date(),
        updated_at: new Date()
      };
      mockDb.schools.push(school);
      return { rows: [school] };
    }

    if (sql.includes('UPDATE schools')) {
      const schoolId = params?.[2];
      const school = mockDb.schools.find(s => s.id === schoolId);
      if (school) {
        school.name = params?.[0];
        school.location = params?.[1];
        school.updated_at = new Date();
        return { rows: [school] };
      }
      return { rows: [] };
    }

    if (sql.includes('DELETE FROM schools WHERE')) {
      const schoolId = params?.[0];
      const index = mockDb.schools.findIndex(s => s.id === schoolId);
      if (index > -1) {
        mockDb.schools.splice(index, 1);
      }
      return { rows: [] };
    }

    // Handle SELECT queries that might be part of delete logic
    if (sql.includes('SELECT DISTINCT u.id') || sql.includes('SELECT u.id FROM users')) {
      return { rows: [] };
    }

    if (sql.includes('DELETE FROM classes') && sql.includes('school_id')) {
      const schoolId = params?.[0];
      mockDb.classes = mockDb.classes.filter(c => c.school_id !== schoolId);
      return { rows: [] };
    }

    if (sql.includes('DELETE FROM users') && sql.includes('school_id')) {
      const schoolId = params?.[0];
      mockDb.users = mockDb.users.filter(u => u.school_id !== schoolId);
      return { rows: [] };
    }

    // Handle BEGIN, COMMIT, ROLLBACK for transactions
    if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK')) {
      return { rows: [] };
    }

    // Catch-all for unmatched queries
    return { rows: [] };
  })
}));

jest.mock('../../services/emailService', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendVerificationEmail: jest.fn()
}));

jest.mock('../../middleware/adminAuth.ts', () => ({
  requireAdmin: async (req: any, res: any, next: any) => {
    req.user = { id: 1, is_admin: true, is_class_admin: false };
    next();
  },
  requireSuperAdmin: async (req: any, res: any, next: any) => {
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
    // Set user before any routes to bypass auth
    app.use((req: any, res: any, next: any) => {
      req.user = { id: 1, is_admin: true, is_class_admin: false };
      next();
    });
    // Mount routes - this should use mocked middleware
    app.use('/api/admin', adminSchoolRoutes);
    // Detailed 404 handler to see unmatched routes
    app.use((req: any, res: any) => {
      res.status(404).json({ error: 'Route not found', path: req.path, method: req.method });
    });
    app.use((err: any, req: any, res: any, next: any) => {
      console.error('Error:', err.message);
      res.status(500).json({ error: err.message });
    });
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

    it('should reject school creation with missing fields', async () => {
      const response = await request(app)
        .post('/api/admin')
        .send({
          name: 'Incomplete School'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/admin/:id', () => {
    it('should update a school', async () => {
      const response = await request(app)
        .put('/api/admin/1')
        .set('Authorization', 'Bearer 1')
        .send({
          name: 'Updated School',
          location: 'Updated City'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('school');
    });

    it('should reject update with missing fields', async () => {
      const response = await request(app)
        .put('/api/admin/1')
        .send({
          name: 'Updated'
        });

      expect(response.status).toBe(400);
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
