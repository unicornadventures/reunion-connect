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
  ],
  classYears: [
    { id: 10, year: 2020 },
    { id: 11, year: 2021 },
    { id: 12, year: 2022 }
  ],
  events: [] as any[]
};

jest.mock('../../middleware/adminAuth', () => ({
  requireSuperAdmin: (req: any, res: any, next: any) => {
    req.user = { id: 1, is_admin: true };
    next();
  },
  requireEventAdmin: jest.fn((req: any, res: any, next: any) => {
    req.user = { id: 1, is_admin: true };
    next();
  }),
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

    // GET single school (full row)
    if (sql.includes('SELECT * FROM schools WHERE id')) {
      const schoolId = Number(params?.[0]);
      const school = mockDb.schools.find(s => s.id === schoolId);
      return { rows: school ? [school] : [] };
    }

    // School existence check (id only)
    if (sql.includes('SELECT id FROM schools WHERE id')) {
      const schoolId = Number(params?.[0]);
      const school = mockDb.schools.find(s => s.id === schoolId);
      return { rows: school ? [{ id: school.id }] : [] };
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
        timezone: params?.[2] || null,
        created_at: new Date(),
        updated_at: new Date()
      };
      mockDb.schools.push(newSchool);
      return { rows: [newSchool] };
    }

    // UPDATE school
    if (sql.includes('UPDATE schools SET')) {
      const schoolId = Number(params?.[params.length - 1]);
      const school: any = mockDb.schools.find(s => s.id === schoolId);
      if (school) {
        school.name = params?.[0];
        school.location = params?.[1] || null;
        school.timezone = params?.[2] || null;
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

    // GET classes by year range (for bulk link)
    if (sql.includes('SELECT id, year FROM classes WHERE year >=')) {
      const startYear = Number(params?.[0]);
      const endYear = Number(params?.[1]);
      const filtered = mockDb.classYears.filter(c => c.year >= startYear && c.year <= endYear);
      return { rows: filtered };
    }

    // INSERT class_school link
    if (sql.includes('INSERT INTO class_school')) {
      return { rows: [] };
    }

    // GET linked classes with member count (for bulk result)
    if (sql.includes('COUNT(cu.user_id)::int AS member_count') && sql.includes('class_school')) {
      return { rows: mockDb.classYears.map(c => ({ id: c.id, year: c.year, member_count: 0 })) };
    }

    // Check class_school link (for event creation)
    if (sql.includes('SELECT 1 FROM class_school WHERE class_id')) {
      const classId = Number(params?.[0]);
      const schoolId = Number(params?.[1]);
      const linked = mockDb.classes.some(c => c.id === classId && c.school_id === schoolId);
      return { rows: linked ? [{ '?column?': 1 }] : [] };
    }

    // Check email uniqueness
    if (sql.includes('SELECT id FROM users WHERE email')) {
      const email = params?.[0];
      const user = mockDb.users.find(u => u.email === email);
      return { rows: user ? [{ id: user.id }] : [] };
    }

    // INSERT user
    if (sql.includes('INSERT INTO users (email, password, is_deceased)')) {
      const newUser = { id: mockDb.users.length + 1, email: params?.[0], is_deceased: params?.[2] ?? false };
      mockDb.users.push({ ...newUser, created_at: new Date() });
      return { rows: [newUser] };
    }

    // INSERT profiles
    if (sql.includes('INSERT INTO profiles')) {
      return { rows: [] };
    }

    // INSERT class_user
    if (sql.includes('INSERT INTO class_user')) {
      return { rows: [] };
    }

    // INSERT events
    if (sql.includes('INSERT INTO events')) {
      const event = {
        id: mockDb.events.length + 1,
        class_id: Number(params?.[0]),
        school_id: Number(params?.[1]),
        title: params?.[2],
        description: params?.[3] || null,
        event_date: params?.[4],
        event_time: params?.[5],
        location: params?.[6] || null,
        created_at: new Date(),
        updated_at: new Date()
      };
      mockDb.events.push(event);
      return { rows: [event] };
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
    mockDb.users = [
      { id: 1, email: 'user1@example.com', created_at: new Date() },
      { id: 2, email: 'user2@example.com', created_at: new Date() }
    ];
    mockDb.classes = [
      { id: 1, school_id: 1, year: 2020, created_at: new Date() },
      { id: 2, school_id: 1, year: 2021, created_at: new Date() }
    ];
    mockDb.classYears = [
      { id: 10, year: 2020 },
      { id: 11, year: 2021 },
      { id: 12, year: 2022 }
    ];
    mockDb.events = [];

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

    it('should create school with a timezone', async () => {
      const response = await request(app)
        .post('/api/admin/schools')
        .send({
          name: 'South High',
          location: 'South, NE',
          timezone: 'America/Chicago'
        });

      expect(response.status).toBe(201);
      expect(response.body.school.timezone).toBe('America/Chicago');
    });

    it('should create school with null timezone by default', async () => {
      const response = await request(app)
        .post('/api/admin/schools')
        .send({ name: 'No TZ High' });

      expect(response.status).toBe(201);
      expect(response.body.school.timezone).toBeNull();
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

    it('should update the timezone', async () => {
      const response = await request(app)
        .put('/api/admin/schools/1')
        .send({
          name: 'Lincoln High',
          location: 'Lincoln, NE',
          timezone: 'America/Chicago'
        });

      expect(response.status).toBe(200);
      expect(response.body.school.timezone).toBe('America/Chicago');
    });

    it('should clear the timezone when omitted', async () => {
      const response = await request(app)
        .put('/api/admin/schools/1')
        .send({ name: 'Lincoln High', location: 'Lincoln, NE' });

      expect(response.status).toBe(200);
      expect(response.body.school.timezone).toBeNull();
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

  describe('POST /api/admin/schools/:id/classes/bulk', () => {
    it('should link class years in bulk', async () => {
      const response = await request(app)
        .post('/api/admin/schools/1/classes/bulk')
        .send({ startYear: 2020 });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('classes');
      expect(Array.isArray(response.body.classes)).toBe(true);
    });

    it('should reject missing startYear', async () => {
      const response = await request(app)
        .post('/api/admin/schools/1/classes/bulk')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject startYear before 1950', async () => {
      const response = await request(app)
        .post('/api/admin/schools/1/classes/bulk')
        .send({ startYear: 1949 });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent school', async () => {
      const response = await request(app)
        .post('/api/admin/schools/999/classes/bulk')
        .send({ startYear: 2020 });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/admin/schools/:id/classes/:classId/users', () => {
    it('should create a user in a class', async () => {
      const response = await request(app)
        .post('/api/admin/schools/1/classes/1/users')
        .send({
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane.smith@example.com'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('jane.smith@example.com');
    });

    it('should create a user without email', async () => {
      const response = await request(app)
        .post('/api/admin/schools/1/classes/1/users')
        .send({
          first_name: 'John',
          last_name: 'Doe'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
    });

    it('should reject missing first_name', async () => {
      const response = await request(app)
        .post('/api/admin/schools/1/classes/1/users')
        .send({
          last_name: 'Doe'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject missing last_name', async () => {
      const response = await request(app)
        .post('/api/admin/schools/1/classes/1/users')
        .send({
          first_name: 'John'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject duplicate email', async () => {
      const response = await request(app)
        .post('/api/admin/schools/1/classes/1/users')
        .send({
          first_name: 'Dupe',
          last_name: 'User',
          email: 'user1@example.com'
        });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/admin/schools/:id/classes/:classId/users/import', () => {
    it('should import multiple users', async () => {
      const response = await request(app)
        .post('/api/admin/schools/1/classes/1/users/import')
        .send({
          users: [
            { first_name: 'Alice', last_name: 'Wonder' },
            { first_name: 'Bob', last_name: 'Builder' }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('created');
      expect(response.body.created).toBe(2);
      expect(response.body).toHaveProperty('skipped');
      expect(response.body.skipped.length).toBe(0);
    });

    it('should skip users with missing names', async () => {
      const response = await request(app)
        .post('/api/admin/schools/1/classes/1/users/import')
        .send({
          users: [
            { first_name: 'Alice', last_name: 'Wonder' },
            { last_name: 'NoFirst' },
            { first_name: 'NoLast' }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body.created).toBe(1);
      expect(response.body.skipped.length).toBe(2);
    });

    it('should skip users with duplicate email', async () => {
      const response = await request(app)
        .post('/api/admin/schools/1/classes/1/users/import')
        .send({
          users: [
            { first_name: 'Dupe', last_name: 'User', email: 'user1@example.com' }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body.created).toBe(0);
      expect(response.body.skipped.length).toBe(1);
      expect(response.body.skipped[0].reason).toBe('Email already exists');
    });

    it('should reject empty users array', async () => {
      const response = await request(app)
        .post('/api/admin/schools/1/classes/1/users/import')
        .send({ users: [] });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject more than 500 users', async () => {
      const users = Array.from({ length: 501 }, (_, i) => ({
        first_name: `First${i}`,
        last_name: `Last${i}`
      }));

      const response = await request(app)
        .post('/api/admin/schools/1/classes/1/users/import')
        .send({ users });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/admin/schools/:schoolId/classes/:classId/events', () => {
    it('should create an event for a school class', async () => {
      const response = await request(app)
        .post('/api/admin/schools/1/classes/1/events')
        .send({
          title: 'Reunion Dinner',
          event_date: '2026-07-15T18:00:00.000Z',
          location: 'Grand Hotel',
          description: 'Annual reunion dinner'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('event');
      expect(response.body.event.title).toBe('Reunion Dinner');
    });

    it('should create event without optional fields', async () => {
      const response = await request(app)
        .post('/api/admin/schools/1/classes/1/events')
        .send({
          title: 'Quick Meetup',
          event_date: '2026-08-01T12:00:00.000Z'
        });

      expect(response.status).toBe(201);
      expect(response.body.event.title).toBe('Quick Meetup');
    });

    it('should reject missing title', async () => {
      const response = await request(app)
        .post('/api/admin/schools/1/classes/1/events')
        .send({
          event_date: '2026-07-15T18:00:00.000Z'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject missing event_date', async () => {
      const response = await request(app)
        .post('/api/admin/schools/1/classes/1/events')
        .send({
          title: 'No Date Event'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 when class is not linked to school', async () => {
      const response = await request(app)
        .post('/api/admin/schools/1/classes/999/events')
        .send({
          title: 'Orphan Event',
          event_date: '2026-07-15T18:00:00.000Z'
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject event creation when requireEventAdmin denies access', async () => {
      const { requireEventAdmin } = require('../../middleware/adminAuth');
      requireEventAdmin.mockImplementationOnce((req: any, res: any) => {
        res.status(403).json({ error: 'Access denied. You can only manage events for your class.' });
      });

      const response = await request(app)
        .post('/api/admin/schools/1/classes/1/events')
        .send({
          title: 'Should Not Be Created',
          event_date: '2026-07-15T18:00:00.000Z'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('Error Handling', () => {
    it('should handle database error in GET all schools', async () => {
      const { query } = require('../../db');
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/admin/schools');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error in GET single school', async () => {
      const { query } = require('../../db');
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/admin/schools/1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error in POST', async () => {
      const { query } = require('../../db');
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .post('/api/admin/schools')
        .send({
          name: 'Error Test School',
          location: 'Test'
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error in PUT', async () => {
      const { query } = require('../../db');
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .put('/api/admin/schools/1')
        .send({
          name: 'Updated School',
          location: 'Updated Location'
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error in DELETE', async () => {
      const { query } = require('../../db');
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .delete('/api/admin/schools/1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
});
