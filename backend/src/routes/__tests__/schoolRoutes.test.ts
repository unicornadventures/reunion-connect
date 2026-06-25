import express, { Express } from 'express';
import request from 'supertest';

const mockDb = {
  schools: [
    { id: 1, name: 'Lincoln High School', location: 'Lincoln, NE', created_at: new Date(), updated_at: new Date() },
    { id: 2, name: 'Central High School', location: 'Central, NE', created_at: new Date(), updated_at: new Date() }
  ],
  events: [
    {
      id: 1,
      class_id: 1,
      school_id: 1,
      title: 'Reunion Dinner',
      description: 'Annual reunion dinner',
      event_date: '2026-07-15',
      event_time: '18:00:00',
      location: 'Grand Hotel',
      created_at: new Date(),
      updated_at: new Date()
    }
  ]
};

jest.mock('../../db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    if (sql.includes('SELECT * FROM schools ORDER BY')) {
      return { rows: mockDb.schools };
    }

    if (sql.includes('SELECT * FROM schools WHERE id')) {
      const schoolId = Number(params?.[0]);
      const school = mockDb.schools.find(s => s.id === schoolId);
      return { rows: school ? [school] : [] };
    }

    if (sql.includes('SELECT id FROM schools WHERE id')) {
      const schoolId = Number(params?.[0]);
      const school = mockDb.schools.find(s => s.id === schoolId);
      return { rows: school ? [{ id: school.id }] : [] };
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

    if (sql.includes('FROM events') && sql.includes('WHERE class_id') && sql.includes('school_id')) {
      const classId = Number(params?.[0]);
      const schoolId = Number(params?.[1]);
      const events = mockDb.events.filter(e => e.class_id === classId && e.school_id === schoolId);
      return { rows: events };
    }

    return { rows: [] };
  })
}));

jest.mock('../../services/emailService', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendVerificationEmail: jest.fn()
}));

import { schoolRoutes } from '../schoolRoutes';

describe('School Routes', () => {
  let app: Express;

  beforeEach(() => {
    mockDb.schools = [
      { id: 1, name: 'Lincoln High School', location: 'Lincoln, NE', created_at: new Date(), updated_at: new Date() },
      { id: 2, name: 'Central High School', location: 'Central, NE', created_at: new Date(), updated_at: new Date() }
    ];
    mockDb.events = [
      {
        id: 1,
        class_id: 1,
        school_id: 1,
        title: 'Reunion Dinner',
        description: 'Annual reunion dinner',
        event_date: '2026-07-15',
        event_time: '18:00:00',
        location: 'Grand Hotel',
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    app = express();
    app.use(express.json());
    app.use('/api/schools', schoolRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/schools', () => {
    it('should return all schools', async () => {
      const response = await request(app).get('/api/schools');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('schools');
      expect(Array.isArray(response.body.schools)).toBe(true);
      expect(response.body.schools.length).toBe(2);
    });

    it('should return schools with required fields', async () => {
      const response = await request(app).get('/api/schools');

      expect(response.status).toBe(200);
      expect(response.body.schools.length).toBeGreaterThan(0);
      const school = response.body.schools[0];
      expect(school).toHaveProperty('id');
      expect(school).toHaveProperty('name');
      expect(school).toHaveProperty('location');
    });
  });

  describe('GET /api/schools/:id', () => {
    it('should return a school by id', async () => {
      const response = await request(app).get('/api/schools/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('school');
      expect(response.body.school.id).toBe(1);
      expect(response.body.school.name).toBe('Lincoln High School');
    });

    it('should return 404 for non-existent school', async () => {
      const response = await request(app).get('/api/schools/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should return school with all required fields', async () => {
      const response = await request(app).get('/api/schools/2');

      expect(response.status).toBe(200);
      const school = response.body.school;
      expect(school).toHaveProperty('id');
      expect(school).toHaveProperty('name');
      expect(school).toHaveProperty('location');
    });
  });

  describe('POST /api/schools', () => {
    it('should create a new school', async () => {
      const response = await request(app)
        .post('/api/schools')
        .send({
          name: 'West High School',
          location: 'West, NE'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('school');
      expect(response.body.school.name).toBe('West High School');
    });

    it('should reject school creation without name', async () => {
      const response = await request(app)
        .post('/api/schools')
        .send({
          location: 'Some Location'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should create school with optional location', async () => {
      const response = await request(app)
        .post('/api/schools')
        .send({
          name: 'East High School'
        });

      expect(response.status).toBe(201);
      expect(response.body.school.name).toBe('East High School');
    });
  });

  describe('GET /api/schools/:schoolId/classes/:classId/events', () => {
    it('should return events for a school class', async () => {
      const response = await request(app).get('/api/schools/1/classes/1/events');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('events');
      expect(Array.isArray(response.body.events)).toBe(true);
      expect(response.body.events.length).toBe(1);
    });

    it('should return events with required fields', async () => {
      const response = await request(app).get('/api/schools/1/classes/1/events');

      expect(response.status).toBe(200);
      const event = response.body.events[0];
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('title');
      expect(event).toHaveProperty('event_date');
      expect(event).toHaveProperty('event_time');
      expect(event).toHaveProperty('location');
    });

    it('should return empty array for class with no events', async () => {
      const response = await request(app).get('/api/schools/1/classes/999/events');

      expect(response.status).toBe(200);
      expect(response.body.events).toEqual([]);
    });

    it('should only return events matching both school and class', async () => {
      mockDb.events.push({
        id: 2,
        class_id: 2,
        school_id: 1,
        title: 'Different Class Event',
        description: null,
        event_date: '2026-09-01',
        event_time: '10:00:00',
        location: 'Somewhere',
        created_at: new Date(),
        updated_at: new Date()
      });

      const response = await request(app).get('/api/schools/1/classes/1/events');

      expect(response.status).toBe(200);
      expect(response.body.events.length).toBe(1);
      expect(response.body.events[0].class_id).toBe(1);
    });

    it('should handle database error', async () => {
      const { query } = require('../../db');
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/schools/1/classes/1/events');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Error Handling', () => {
    it('should handle database error in GET all schools', async () => {
      const { query } = require('../../db');
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/schools');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error in GET single school', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/schools/1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error in POST', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .post('/api/schools')
        .send({
          name: 'Error Test School',
          location: 'Test Location'
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
});
