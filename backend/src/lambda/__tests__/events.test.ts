import { APIGatewayProxyEvent } from 'aws-lambda';

const mockDb = {
  events: [
    { id: 1, class_id: 10, school_id: 5, event_name: 'Reunion Dinner', description: null, event_date: '2026-07-15', event_time: '18:00:00' }
  ],
  classSchoolLinks: [{ class_id: 10, school_id: 5 }],
  classUsers: [{ user_id: 2, class_id: 10 }] // user 2 is a class admin who belongs to class 10
};

jest.mock('../../db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    if (sql.includes('SELECT id FROM class_user WHERE user_id')) {
      const [userId, classId] = params!;
      const match = mockDb.classUsers.some(cu => cu.user_id === Number(userId) && cu.class_id === Number(classId));
      return { rows: match ? [{ id: 1 }] : [] };
    }

    if (sql.includes('SELECT 1 FROM class_school WHERE class_id')) {
      const [classId, schoolId] = params!;
      const match = mockDb.classSchoolLinks.some(l => l.class_id === Number(classId) && l.school_id === Number(schoolId));
      return { rows: match ? [{ '?column?': 1 }] : [] };
    }

    if (sql.includes('SELECT id, class_id') && sql.includes('FROM events WHERE id')) {
      const eventId = Number(params![0]);
      const event = mockDb.events.find(e => e.id === eventId);
      return { rows: event ? [{ id: event.id, class_id: event.class_id }] : [] };
    }

    if (sql.includes('INSERT INTO events')) {
      const [classId, schoolId, title, description, eventDate, eventTime, location] = params!;
      const newEvent = {
        id: mockDb.events.length + 1,
        class_id: Number(classId),
        school_id: Number(schoolId),
        event_name: title,
        description,
        event_date: eventDate,
        event_time: eventTime,
        location
      };
      mockDb.events.push(newEvent);
      return { rows: [{ ...newEvent, title: newEvent.event_name }] };
    }

    if (sql.includes('UPDATE events')) {
      const eventId = Number(params![params!.length - 1]);
      const event = mockDb.events.find(e => e.id === eventId);
      if (!event) return { rows: [] };
      return { rows: [{ ...event, title: event.event_name }] };
    }

    if (sql.includes('DELETE FROM events WHERE id')) {
      const eventId = Number(params![0]);
      const index = mockDb.events.findIndex(e => e.id === eventId);
      if (index === -1) return { rows: [] };
      const [deleted] = mockDb.events.splice(index, 1);
      return { rows: [{ id: deleted.id }] };
    }

    return { rows: [] };
  })
}));

jest.mock('../init', () => ({ dbReady: Promise.resolve() }));

jest.mock('../authUtils', () => ({ getAuthUser: jest.fn() }));

import { createEventHandler, updateEventHandler, deleteEventHandler } from '../events';
import { getAuthUser } from '../authUtils';

const mockGetAuthUser = getAuthUser as jest.Mock;

const superAdmin = { id: 1, email: 'super@x.com', is_admin: true, is_class_admin: false };
const classAdminInClass = { id: 2, email: 'classadmin@x.com', is_admin: false, is_class_admin: true }; // belongs to class 10
const classAdminOutOfClass = { id: 3, email: 'other@x.com', is_admin: false, is_class_admin: true }; // not in class 10
const regularUser = { id: 4, email: 'user@x.com', is_admin: false, is_class_admin: false };

const makeEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent => ({
  headers: { Authorization: 'Bearer token' },
  pathParameters: {},
  body: null,
  httpMethod: 'GET',
  ...overrides
} as APIGatewayProxyEvent);

describe('Lambda event handlers — permissions', () => {
  beforeEach(() => {
    mockDb.events = [
      { id: 1, class_id: 10, school_id: 5, event_name: 'Reunion Dinner', description: null, event_date: '2026-07-15', event_time: '18:00:00' }
    ];
    jest.clearAllMocks();
  });

  describe('createEventHandler', () => {
    const baseEvent = () => makeEvent({
      pathParameters: { schoolId: '5', classId: '10' },
      body: JSON.stringify({ title: 'New Event', event_date: '2026-09-01T12:00:00.000Z' })
    });

    it('returns 401 when unauthenticated', async () => {
      mockGetAuthUser.mockReturnValue(null);
      const result = await createEventHandler(baseEvent());
      expect(result.statusCode).toBe(401);
    });

    it('allows super admin', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await createEventHandler(baseEvent());
      expect(result.statusCode).toBe(201);
    });

    it('allows class admin who belongs to the class', async () => {
      mockGetAuthUser.mockReturnValue(classAdminInClass);
      const result = await createEventHandler(baseEvent());
      expect(result.statusCode).toBe(201);
    });

    it('denies class admin who does not belong to the class', async () => {
      mockGetAuthUser.mockReturnValue(classAdminOutOfClass);
      const result = await createEventHandler(baseEvent());
      expect(result.statusCode).toBe(403);
    });

    it('denies a regular user', async () => {
      mockGetAuthUser.mockReturnValue(regularUser);
      const result = await createEventHandler(baseEvent());
      expect(result.statusCode).toBe(403);
    });
  });

  describe('updateEventHandler', () => {
    const baseEvent = () => makeEvent({
      pathParameters: { eventId: '1' },
      body: JSON.stringify({ title: 'Updated Event' })
    });

    it('returns 401 when unauthenticated', async () => {
      mockGetAuthUser.mockReturnValue(null);
      const result = await updateEventHandler(baseEvent());
      expect(result.statusCode).toBe(401);
    });

    it('allows super admin', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await updateEventHandler(baseEvent());
      expect(result.statusCode).toBe(200);
    });

    it('allows class admin who belongs to the event\'s class', async () => {
      mockGetAuthUser.mockReturnValue(classAdminInClass);
      const result = await updateEventHandler(baseEvent());
      expect(result.statusCode).toBe(200);
    });

    it('denies class admin who does not belong to the event\'s class', async () => {
      mockGetAuthUser.mockReturnValue(classAdminOutOfClass);
      const result = await updateEventHandler(baseEvent());
      expect(result.statusCode).toBe(403);
    });

    it('denies a regular user', async () => {
      mockGetAuthUser.mockReturnValue(regularUser);
      const result = await updateEventHandler(baseEvent());
      expect(result.statusCode).toBe(403);
    });

    it('returns 404 for a non-existent event', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await updateEventHandler(makeEvent({ pathParameters: { eventId: '999' }, body: JSON.stringify({ title: 'X' }) }));
      expect(result.statusCode).toBe(404);
    });
  });

  describe('deleteEventHandler', () => {
    const baseEvent = () => makeEvent({ pathParameters: { eventId: '1' } });

    it('returns 401 when unauthenticated', async () => {
      mockGetAuthUser.mockReturnValue(null);
      const result = await deleteEventHandler(baseEvent());
      expect(result.statusCode).toBe(401);
    });

    it('denies class admin who does not belong to the event\'s class', async () => {
      mockGetAuthUser.mockReturnValue(classAdminOutOfClass);
      const result = await deleteEventHandler(baseEvent());
      expect(result.statusCode).toBe(403);
    });

    it('denies a regular user', async () => {
      mockGetAuthUser.mockReturnValue(regularUser);
      const result = await deleteEventHandler(baseEvent());
      expect(result.statusCode).toBe(403);
    });

    it('allows class admin who belongs to the event\'s class', async () => {
      mockGetAuthUser.mockReturnValue(classAdminInClass);
      const result = await deleteEventHandler(baseEvent());
      expect(result.statusCode).toBe(200);
    });

    it('allows super admin', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await deleteEventHandler(baseEvent());
      expect(result.statusCode).toBe(200);
    });

    it('returns 404 for a non-existent event', async () => {
      mockGetAuthUser.mockReturnValue(superAdmin);
      const result = await deleteEventHandler(makeEvent({ pathParameters: { eventId: '999' } }));
      expect(result.statusCode).toBe(404);
    });
  });
});
