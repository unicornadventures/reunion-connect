import express, { Express } from 'express';
import request from 'supertest';

const mockDb = {
  classes: [
    { id: 1, name: 'Class of 2024', school_id: 1, created_at: new Date(), updated_at: new Date() },
    { id: 2, name: 'Class of 2023', school_id: 1, created_at: new Date(), updated_at: new Date() }
  ],
  events: [
    {
      id: 1,
      class_id: 1,
      event_name: 'Reunion Dinner',
      event_date: '2024-06-15',
      event_time: '19:00',
      location: 'Downtown Hotel',
      description: 'Annual reunion dinner',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 2,
      class_id: 1,
      event_name: 'Picnic',
      event_date: '2024-07-20',
      event_time: '14:00',
      location: 'Central Park',
      description: null,
      created_at: new Date(),
      updated_at: new Date()
    }
  ]
};

jest.mock('../../db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    if (sql.includes('SELECT id FROM classes WHERE id')) {
      const classId = Number(params?.[0]);
      const classRow = mockDb.classes.find(c => c.id === classId);
      return { rows: classRow ? [{ id: classRow.id }] : [] };
    }

    if (sql.includes('INSERT INTO events')) {
      const event = {
        id: mockDb.events.length + 1,
        class_id: Number(params?.[0]),
        event_name: params?.[1],
        event_date: params?.[2],
        event_time: params?.[3],
        location: params?.[4],
        description: params?.[5] || null,
        created_at: new Date(),
        updated_at: new Date()
      };
      mockDb.events.push(event);
      return { rows: [event] };
    }

    if (sql.includes('UPDATE events')) {
      const eventId = Number(params?.[params.length - 1]);
      const event = mockDb.events.find(e => e.id === eventId);
      if (event) {
        event.event_name = params?.[0];
        event.event_date = params?.[1];
        event.event_time = params?.[2];
        event.location = params?.[3];
        event.description = params?.[4] || null;
        event.updated_at = new Date();
        return { rows: [{ ...event }] };
      }
      return { rows: [] };
    }

    if (sql.includes('DELETE FROM events')) {
      const eventId = Number(params?.[0]);
      const event = mockDb.events.find(e => e.id === eventId);
      if (event) {
        const index = mockDb.events.findIndex(e => e.id === eventId);
        mockDb.events.splice(index, 1);
        return { rows: [{ ...event }] };
      }
      return { rows: [] };
    }

    return { rows: [] };
  })
}));

jest.mock('../../middleware/adminAuth', () => ({
  requireEventAdmin: (req: any, res: any, next: any) => {
    req.user = { id: 1, is_admin: true, is_class_admin: true };
    next();
  },
  requireSuperAdmin: (req: any, res: any, next: any) => {
    req.user = { id: 1, is_admin: true };
    next();
  }
}));

jest.mock('../../services/emailService', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendVerificationEmail: jest.fn()
}));

import { adminEventRoutes } from '../adminEventRoutes';

describe('Admin Event Routes', () => {
  let app: Express;

  beforeEach(() => {
    mockDb.events = [
      {
        id: 1,
        class_id: 1,
        event_name: 'Reunion Dinner',
        event_date: '2024-06-15',
        event_time: '19:00',
        location: 'Downtown Hotel',
        description: 'Annual reunion dinner',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 2,
        class_id: 1,
        event_name: 'Picnic',
        event_date: '2024-07-20',
        event_time: '14:00',
        location: 'Central Park',
        description: null,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    app = express();
    app.use(express.json());
    app.use('/api/admin/events', adminEventRoutes);
    jest.clearAllMocks();
  });

  describe('POST /api/admin/events', () => {
    it('should create a new event', async () => {
      const response = await request(app)
        .post('/api/admin/events')
        .send({
          class_id: 1,
          event_name: 'Holiday Party',
          event_date: '2024-12-20',
          event_time: '18:00',
          location: 'Restaurant',
          description: 'Holiday celebration'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('event');
      expect(response.body.event.event_name).toBe('Holiday Party');
    });

    it('should reject event creation without required fields', async () => {
      const response = await request(app)
        .post('/api/admin/events')
        .send({
          class_id: 1,
          event_name: 'Holiday Party'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject event for non-existent class', async () => {
      const response = await request(app)
        .post('/api/admin/events')
        .send({
          class_id: 999,
          event_name: 'Holiday Party',
          event_date: '2024-12-20',
          event_time: '18:00',
          location: 'Restaurant'
        });

      expect(response.status).toBe(400);
    });

    it('should create event with optional description', async () => {
      const response = await request(app)
        .post('/api/admin/events')
        .send({
          class_id: 1,
          event_name: 'Game Night',
          event_date: '2024-08-10',
          event_time: '19:00',
          location: 'Someone\'s House'
        });

      expect(response.status).toBe(201);
      expect(response.body.event.event_name).toBe('Game Night');
    });
  });

  describe('PUT /api/admin/events/:id', () => {
    it('should update an event', async () => {
      const response = await request(app)
        .put('/api/admin/events/1')
        .send({
          event_name: 'Updated Dinner',
          event_date: '2024-06-20',
          event_time: '20:00',
          location: 'New Restaurant'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('event');
      expect(response.body.event.event_name).toBe('Updated Dinner');
    });

    it('should reject update without required fields', async () => {
      const response = await request(app)
        .put('/api/admin/events/1')
        .send({
          event_name: 'Updated Dinner'
        });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent event', async () => {
      const response = await request(app)
        .put('/api/admin/events/999')
        .send({
          event_name: 'Updated Event',
          event_date: '2024-08-01',
          event_time: '18:00',
          location: 'Somewhere'
        });

      expect(response.status).toBe(404);
    });

    it('should update event with optional description', async () => {
      const response = await request(app)
        .put('/api/admin/events/1')
        .send({
          event_name: 'Dinner',
          event_date: '2024-06-15',
          event_time: '19:00',
          location: 'Hotel',
          description: 'Updated description'
        });

      expect(response.status).toBe(200);
      expect(response.body.event.description).toBe('Updated description');
    });
  });

  describe('DELETE /api/admin/events/:id', () => {
    it('should delete an event', async () => {
      const response = await request(app)
        .delete('/api/admin/events/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should return 404 for non-existent event', async () => {
      const response = await request(app)
        .delete('/api/admin/events/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should confirm event is deleted', async () => {
      await request(app).delete('/api/admin/events/1');

      const response = await request(app)
        .delete('/api/admin/events/1');

      expect(response.status).toBe(404);
    });
  });
});
