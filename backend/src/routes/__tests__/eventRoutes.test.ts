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
    // Check if class exists
    if (sql.includes('SELECT id FROM classes WHERE id')) {
      const classId = Number(params?.[0]);
      const cls = mockDb.classes.find(c => c.id === classId);
      return { rows: cls ? [{ id: cls.id }] : [] };
    }

    // Get events for a class with date/time filtering
    if (sql.includes('SELECT id, event_name, event_date, event_time, location, description') && sql.includes('WHERE class_id')) {
      const classId = Number(params?.[0]);
      const events = mockDb.events.filter(e => e.class_id === classId);
      return { rows: events };
    }

    // Get single event by id
    if (sql.includes('SELECT id, class_id, event_name, event_date, event_time, location, description, created_at, updated_at') && sql.includes('WHERE id')) {
      const eventId = Number(params?.[0]);
      const event = mockDb.events.find(e => e.id === eventId);
      return { rows: event ? [event] : [] };
    }

    // Get next event for days-until calculation
    if (sql.includes('SELECT event_date FROM events') && sql.includes('WHERE class_id') && sql.includes('LIMIT 1')) {
      const classId = Number(params?.[0]);
      const events = mockDb.events.filter(e => e.class_id === classId);
      return { rows: events.slice(0, 1) };
    }

    return { rows: [] };
  })
}));

import { eventRoutes } from '../eventRoutes';

describe('Event Routes', () => {
  let app: Express;

  beforeEach(() => {
    mockDb.events = [
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
    ];

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

    it('should return 404 for non-existent class', async () => {
      const response = await request(app).get('/api/events/class/999/events');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
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

  describe('GET /api/events/:eventId', () => {
    it('should return a single event by id', async () => {
      const response = await request(app).get('/api/events/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('event');
      expect(response.body.event.id).toBe(1);
    });

    it('should return 404 for non-existent event', async () => {
      const response = await request(app).get('/api/events/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should return event with all required fields', async () => {
      const response = await request(app).get('/api/events/1');

      expect(response.status).toBe(200);
      const event = response.body.event;
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('class_id');
      expect(event).toHaveProperty('event_name');
      expect(event).toHaveProperty('event_date');
    });
  });

  describe('GET /api/events/class/:classId/days-until-next', () => {
    it('should return days until next event', async () => {
      const response = await request(app).get('/api/events/class/1/days-until-next');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('daysUntil');
    });

    it('should return null for class with no upcoming events', async () => {
      const response = await request(app).get('/api/events/class/999/days-until-next');

      expect(response.status).toBe(200);
      expect(response.body.daysUntil).toBeNull();
    });

    it('should return eventDate for class with upcoming events', async () => {
      const response = await request(app).get('/api/events/class/1/days-until-next');

      expect(response.status).toBe(200);
      if (response.body.daysUntil !== null) {
        expect(response.body).toHaveProperty('eventDate');
      }
    });
  });
});
