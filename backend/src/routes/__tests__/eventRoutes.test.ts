import express, { Express } from 'express';
import request from 'supertest';

// Mock database
const mockDb = {
  events: [
    {
      id: 1,
      class_id: 1,
      event_name: 'Reunion Dinner',
      event_date: '2026-07-15',
      event_time: '18:00:00',
      location: 'Grand Hotel',
      description: 'Annual reunion dinner',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 2,
      class_id: 1,
      event_name: 'Golf Outing',
      event_date: '2026-08-20',
      event_time: '09:00:00',
      location: 'Country Club',
      description: 'Friendly golf tournament',
      created_at: new Date(),
      updated_at: new Date()
    }
  ],
  classes: [
    { id: 1, school_id: 1, year: 2020 },
    { id: 2, school_id: 1, year: 2021 }
  ]
};

jest.mock('../../db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    if (sql.includes('SELECT id FROM classes WHERE id')) {
      const classId = params?.[0];
      const cls = mockDb.classes.find(c => c.id === classId);
      return { rows: cls ? [{ id: cls.id }] : [] };
    }

    if (sql.includes('INSERT INTO events')) {
      const event = {
        id: mockDb.events.length + 1,
        class_id: params?.[0],
        event_name: params?.[1],
        event_date: params?.[2],
        event_time: params?.[3],
        location: params?.[4],
        description: params?.[5],
        created_at: new Date(),
        updated_at: new Date()
      };
      mockDb.events.push(event);
      return { rows: [event] };
    }

    if (sql.includes('SELECT * FROM events WHERE class_id') && sql.includes('ORDER BY')) {
      const classId = params?.[0];
      const events = mockDb.events.filter(e => e.class_id === classId);
      return { rows: events };
    }

    if (sql.includes('SELECT * FROM events WHERE id')) {
      const eventId = params?.[0];
      const event = mockDb.events.find(e => e.id === eventId);
      return { rows: event ? [event] : [] };
    }

    if (sql.includes('UPDATE events')) {
      const eventId = params?.[params.length - 1];
      const event = mockDb.events.find(e => e.id === eventId);
      if (event) {
        event.event_name = params?.[0];
        event.event_date = params?.[1];
        event.event_time = params?.[2];
        event.location = params?.[3];
        event.description = params?.[4];
        event.updated_at = new Date();
      }
      return { rows: [] };
    }

    if (sql.includes('DELETE FROM events')) {
      const eventId = params?.[0];
      const index = mockDb.events.findIndex(e => e.id === eventId);
      if (index > -1) {
        mockDb.events.splice(index, 1);
      }
      return { rows: [] };
    }

    return { rows: [] };
  })
}));

import { eventRoutes } from '../eventRoutes';

describe('Event Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/events', eventRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/events/class/:classId/events', () => {
    it('should return events for a class', async () => {
      const response = await request(app).get('/api/events/class/1/events');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('events');
      expect(Array.isArray(response.body.events)).toBe(true);
    });

    it('should return events with required fields', async () => {
      const response = await request(app).get('/api/events/class/1/events');

      expect(response.status).toBe(200);
      if (response.body.events.length > 0) {
        const event = response.body.events[0];
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('event_name');
        expect(event).toHaveProperty('event_date');
        expect(event).toHaveProperty('event_time');
        expect(event).toHaveProperty('location');
      }
    });

    it('should return empty array for class with no events', async () => {
      const response = await request(app).get('/api/events/class/999/events');

      expect(response.status).toBe(200);
      expect(response.body.events.length).toBe(0);
    });

    it('should filter events by date (future dates only)', async () => {
      const response = await request(app).get('/api/events/class/1/events');

      expect(response.status).toBe(200);
      // Events should be filtered to show only future dates
      response.body.events.forEach((event: any) => {
        const eventDate = new Date(event.event_date);
        expect(eventDate.getTime()).toBeGreaterThanOrEqual(new Date().getTime());
      });
    });

    it('should order events by date ascending', async () => {
      const response = await request(app).get('/api/events/class/1/events');

      expect(response.status).toBe(200);
      if (response.body.events.length > 1) {
        for (let i = 0; i < response.body.events.length - 1; i++) {
          const current = new Date(response.body.events[i].event_date);
          const next = new Date(response.body.events[i + 1].event_date);
          expect(current.getTime()).toBeLessThanOrEqual(next.getTime());
        }
      }
    });
  });

  describe('POST /api/events', () => {
    it('should create a new event', async () => {
      const response = await request(app)
        .post('/api/events')
        .send({
          class_id: 1,
          event_name: 'Beach Party',
          event_date: '2026-09-10',
          event_time: '14:00:00',
          location: 'Sunny Beach',
          description: 'Fun beach gathering'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('event');
      expect(response.body.event.event_name).toBe('Beach Party');
    });

    it('should reject event creation with missing required fields', async () => {
      const response = await request(app)
        .post('/api/events')
        .send({
          class_id: 1,
          event_name: 'Incomplete Event'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject event with non-existent class', async () => {
      const response = await request(app)
        .post('/api/events')
        .send({
          class_id: 999,
          event_name: 'Invalid Event',
          event_date: '2026-09-10',
          event_time: '14:00:00',
          location: 'Venue',
          description: 'Description'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/events/:id', () => {
    it('should update an event', async () => {
      const response = await request(app)
        .put('/api/events/1')
        .send({
          event_name: 'Updated Reunion',
          event_date: '2026-07-20',
          event_time: '19:00:00',
          location: 'New Venue',
          description: 'Updated description'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should reject update with missing required fields', async () => {
      const response = await request(app)
        .put('/api/events/1')
        .send({
          event_name: 'Updated Event'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/events/:id', () => {
    it('should delete an event', async () => {
      const response = await request(app)
        .delete('/api/events/2');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle deletion of non-existent event', async () => {
      const response = await request(app)
        .delete('/api/events/999');

      expect([200, 404]).toContain(response.status);
    });
  });
});
