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
    if (sql.includes('SELECT id, name, location') && !sql.includes('WHERE')) {
      return { rows: mockDb.schools };
    }

    if (sql.includes('SELECT id, name, location') && sql.includes('WHERE id')) {
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
      }
      return { rows: [] };
    }

    if (sql.includes('DELETE FROM schools')) {
      const schoolId = params?.[0];
      const index = mockDb.schools.findIndex(s => s.id === schoolId);
      if (index > -1) {
        mockDb.schools.splice(index, 1);
      }
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

    return { rows: [] };
  })
}));

jest.mock('../../services/emailService', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendVerificationEmail: jest.fn()
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

  describe('GET /api/admin/schools', () => {
    it('should return all schools', async () => {
      const response = await request(app).get('/api/admin/schools');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('schools');
      expect(Array.isArray(response.body.schools)).toBe(true);
      expect(response.body.schools.length).toBeGreaterThan(0);
    });

    it('should return schools with required fields', async () => {
      const response = await request(app).get('/api/admin/schools');

      expect(response.status).toBe(200);
      const school = response.body.schools[0];
      expect(school).toHaveProperty('id');
      expect(school).toHaveProperty('name');
      expect(school).toHaveProperty('location');
    });
  });

  describe('POST /api/admin/schools', () => {
    it('should create a new school', async () => {
      const response = await request(app)
        .post('/api/admin/schools')
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
        .post('/api/admin/schools')
        .send({
          name: 'Incomplete School'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/admin/schools/:id', () => {
    it('should update a school', async () => {
      const response = await request(app)
        .put('/api/admin/schools/1')
        .send({
          name: 'Updated School',
          location: 'Updated City'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should reject update with missing fields', async () => {
      const response = await request(app)
        .put('/api/admin/schools/1')
        .send({
          name: 'Updated'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/admin/schools/:id', () => {
    it('should delete a school', async () => {
      const response = await request(app)
        .delete('/api/admin/schools/2');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle deletion of non-existent school', async () => {
      const response = await request(app)
        .delete('/api/admin/schools/999');

      expect([200, 404]).toContain(response.status);
    });
  });
});
