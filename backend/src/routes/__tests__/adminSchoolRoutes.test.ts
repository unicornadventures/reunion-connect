import express, { Express } from 'express';
import request from 'supertest';

const mockDb = {
  schools: [
    { id: 1, name: 'Lincoln High', location: 'Lincoln, NE', created_at: new Date(), updated_at: new Date() },
    { id: 2, name: 'Central High', location: 'Central, NE', created_at: new Date(), updated_at: new Date() },
    { id: 3, name: 'East High', location: 'East, NE', created_at: new Date(), updated_at: new Date() }
  ],
  users: [
    { id: 1, email: 'user1@example.com', created_at: new Date() },
    { id: 2, email: 'user2@example.com', created_at: new Date() }
  ],
  classUsers: [
    { class_id: 1, user_id: 1 },
    { class_id: 1, user_id: 2 }
  ],
  classes: [
    { id: 1, school_id: 1, year: 2020, created_at: new Date() },
    { id: 2, school_id: 1, year: 2021, created_at: new Date() }
  ]
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
    // Transaction control
    if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK')) {
      return { rows: [] };
    }

    // GET all schools
    if (sql.includes('SELECT * FROM schools') && !sql.includes('WHERE') && !sql.includes('JOIN')) {
      const sorted = [...mockDb.schools].sort((a, b) => a.name.localeCompare(b.name));
      return { rows: sorted };
    }

    // GET single school
    if (sql.includes('SELECT * FROM schools WHERE id')) {
      const schoolId = Number(params?.[0]);
      const school = mockDb.schools.find(s => s.id === schoolId);
      return { rows: school ? [school] : [] };
    }

    // GET users for cascading delete
    if (sql.includes('SELECT DISTINCT u.id') && sql.includes('JOIN class_user') && sql.includes('JOIN classes')) {
      const schoolId = Number(params?.[0]);
      const classIds = mockDb.classes.filter(c => c.school_id === schoolId).map(c => c.id);
      const users = mockDb.classUsers
        .filter(cu => classIds.includes(cu.class_id))
        .map(cu => ({ id: cu.user_id }));
      return { rows: users };
    }

    // DELETE users
    if (sql.includes('DELETE FROM users') && sql.includes('WHERE id IN')) {
      return { rows: [] };
    }

    // INSERT school
    if (sql.includes('INSERT INTO schools')) {
      const newSchool = {
        id: Math.max(...mockDb.schools.map(s => s.id), 0) + 1,
        name: params?.[0],
        location: params?.[1] || null,
        created_at: new Date(),
        updated_at: new Date()
      };
      mockDb.schools.push(newSchool);
      return { rows: [newSchool] };
    }

    // UPDATE school
    if (sql.includes('UPDATE schools SET')) {
      const schoolId = Number(params?.[params.length - 1]);
      const school = mockDb.schools.find(s => s.id === schoolId);
      if (school) {
        school.name = params?.[0];
        school.location = params?.[1] || null;
        school.updated_at = new Date();
        return { rows: [{ ...school }] };
      }
      return { rows: [] };
    }

    // DELETE school
    if (sql.includes('DELETE FROM schools WHERE id')) {
      const schoolId = Number(params?.[0]);
      const school = mockDb.schools.find(s => s.id === schoolId);
      if (school) {
        const index = mockDb.schools.findIndex(s => s.id === schoolId);
        mockDb.schools.splice(index, 1);
        return { rows: [{ ...school }] };
      }
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

import { adminSchoolRoutes } from '../adminSchoolRoutes';

describe('Admin School Routes', () => {
  let app: Express;

  beforeEach(() => {
    mockDb.schools = [
      { id: 1, name: 'Lincoln High', location: 'Lincoln, NE', created_at: new Date(), updated_at: new Date() },
      { id: 2, name: 'Central High', location: 'Central, NE', created_at: new Date(), updated_at: new Date() },
      { id: 3, name: 'East High', location: 'East, NE', created_at: new Date(), updated_at: new Date() }
    ];

    app = express();
    app.use(express.json());
    app.use('/api/admin/schools', adminSchoolRoutes);
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

    it('should return schools ordered by name', async () => {
      const response = await request(app).get('/api/admin/schools');

      expect(response.status).toBe(200);
      if (response.body.schools.length > 1) {
        for (let i = 0; i < response.body.schools.length - 1; i++) {
          expect(response.body.schools[i].name <= response.body.schools[i + 1].name).toBe(true);
        }
      }
    });
  });

  describe('GET /api/admin/schools/:id', () => {
    it('should return a specific school', async () => {
      const response = await request(app).get('/api/admin/schools/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('school');
      expect(response.body.school.id).toBe(1);
      expect(response.body.school.name).toBe('Lincoln High');
    });

    it('should return school with all fields', async () => {
      const response = await request(app).get('/api/admin/schools/1');

      expect(response.status).toBe(200);
      const school = response.body.school;
      expect(school).toHaveProperty('id');
      expect(school).toHaveProperty('name');
      expect(school).toHaveProperty('location');
      expect(school).toHaveProperty('created_at');
      expect(school).toHaveProperty('updated_at');
    });

    it('should return 404 for non-existent school', async () => {
      const response = await request(app).get('/api/admin/schools/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/admin/schools', () => {
    it('should create a new school', async () => {
      const response = await request(app)
        .post('/api/admin/schools')
        .send({
          name: 'West High',
          location: 'West, NE'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('school');
      expect(response.body.school.name).toBe('West High');
      expect(response.body.school.location).toBe('West, NE');
    });

    it('should create school with optional location', async () => {
      const response = await request(app)
        .post('/api/admin/schools')
        .send({
          name: 'North High'
        });

      expect(response.status).toBe(201);
      expect(response.body.school.name).toBe('North High');
      expect(response.body.school.location).toBeNull();
    });

    it('should reject school creation without name', async () => {
      const response = await request(app)
        .post('/api/admin/schools')
        .send({
          location: 'Some City'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/admin/schools/:id', () => {
    it('should update school name and location', async () => {
      const response = await request(app)
        .put('/api/admin/schools/1')
        .send({
          name: 'Lincoln High School',
          location: 'Lincoln, Nebraska'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('school');
      expect(response.body.school.name).toBe('Lincoln High School');
      expect(response.body.school.location).toBe('Lincoln, Nebraska');
    });

    it('should update with optional location', async () => {
      const response = await request(app)
        .put('/api/admin/schools/1')
        .send({
          name: 'Lincoln High',
          location: null
        });

      expect(response.status).toBe(200);
      expect(response.body.school.location).toBeNull();
    });

    it('should reject update without name', async () => {
      const response = await request(app)
        .put('/api/admin/schools/1')
        .send({
          location: 'New Location'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent school', async () => {
      const response = await request(app)
        .put('/api/admin/schools/999')
        .send({
          name: 'Test School',
          location: 'Test'
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/admin/schools/:id', () => {
    it('should delete a school', async () => {
      const response = await request(app)
        .delete('/api/admin/schools/2');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should return 404 for non-existent school', async () => {
      const response = await request(app)
        .delete('/api/admin/schools/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should support cascadeUsers query parameter', async () => {
      const response = await request(app)
        .delete('/api/admin/schools/1?cascadeUsers=true');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should delete without cascadeUsers', async () => {
      const response = await request(app)
        .delete('/api/admin/schools/3');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle cascadeUsers=false', async () => {
      const response = await request(app)
        .delete('/api/admin/schools/2?cascadeUsers=false');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });
  });
});
