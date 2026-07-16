import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../db.js';
import { dbReady } from './init.js';
import { getAuthUser } from './authUtils.js';

const response = (statusCode: number, body: any): APIGatewayProxyResult => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  },
  body: JSON.stringify(body)
});

const errorResponse = (statusCode: number, message: string): APIGatewayProxyResult =>
  response(statusCode, { error: message });

async function canManageEvent(authUser: any, classId: string): Promise<boolean> {
  if (authUser.is_admin) return true;
  if (!authUser.is_class_admin) return false;
  const result = await query('SELECT id FROM class_user WHERE user_id = $1 AND class_id = $2', [authUser.id, classId]);
  return result.rows.length > 0;
}

/**
 * Lambda handler for GET /api/schools/{schoolId}/classes/{classId}/events
 */
export const listEventsHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;
    const { schoolId, classId } = event.pathParameters || {};

    if (!schoolId || !classId) {
      return errorResponse(400, 'schoolId and classId are required.');
    }

    const result = await query(
      `SELECT id, class_id, school_id, event_name as title, description, to_char(event_date, 'YYYY-MM-DD') as event_date, event_time, location, created_at, updated_at
       FROM events
       WHERE class_id = $1 AND school_id = $2
       ORDER BY event_date ASC, event_time ASC NULLS LAST;`,
      [classId, schoolId]
    );

    return response(200, { events: result.rows });
  } catch (error: any) {
    console.error('List events handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for GET /api/events/{eventId}
 */
export const getEventHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;
    const { eventId } = event.pathParameters || {};

    if (!eventId) {
      return errorResponse(400, 'Event ID required.');
    }

    const result = await query(
      `SELECT id, class_id, school_id, event_name as title, description, to_char(event_date, 'YYYY-MM-DD') as event_date, event_time, location, created_at, updated_at
       FROM events WHERE id = $1`,
      [eventId]
    );

    if (result.rows.length === 0) {
      return errorResponse(404, 'Event not found.');
    }

    return response(200, { event: result.rows[0] });
  } catch (error: any) {
    console.error('Get event handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for POST /api/admin/schools/{schoolId}/classes/{classId}/events
 */
export const createEventHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') return response(200, {});
  try {
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;
    const { schoolId, classId } = event.pathParameters || {};
    const { title, description, event_date, location } = JSON.parse(event.body || '{}');

    if (!schoolId || !classId || !title || !event_date) {
      return errorResponse(400, 'schoolId, classId, title, and event_date are required.');
    }

    if (!(await canManageEvent(authUser, classId))) {
      return errorResponse(403, 'Access denied. You can only manage events for your class.');
    }

    const linkCheck = await query(
      'SELECT 1 FROM class_school WHERE class_id = $1 AND school_id = $2',
      [classId, schoolId]
    );
    if (linkCheck.rows.length === 0) {
      return errorResponse(404, 'Class is not linked to this school.');
    }

    const eventDateTime = new Date(event_date);
    const eventDateOnly = eventDateTime.toISOString().split('T')[0];
    const eventTimeOnly = eventDateTime.toISOString().split('T')[1].substring(0, 8);

    const result = await query(
      `INSERT INTO events (class_id, school_id, event_name, description, event_date, event_time, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, class_id, school_id, event_name as title, description, to_char(event_date, 'YYYY-MM-DD') as event_date, event_time, location, created_at, updated_at;`,
      [classId, schoolId, title, description || null, eventDateOnly, eventTimeOnly, location || null]
    );

    return response(201, { event: result.rows[0] });
  } catch (error: any) {
    console.error('Create event handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for PUT /api/events/{eventId}
 */
export const updateEventHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;

    const { eventId } = event.pathParameters || {};
    const { title, description, event_date, location } = JSON.parse(event.body || '{}');

    if (!eventId) {
      return errorResponse(400, 'Event ID required.');
    }

    const eventCheck = await query('SELECT id, class_id FROM events WHERE id = $1', [eventId]);
    if (eventCheck.rows.length === 0) {
      return errorResponse(404, 'Event not found.');
    }

    if (!(await canManageEvent(authUser, eventCheck.rows[0].class_id))) {
      return errorResponse(403, 'Access denied. You can only manage events for your class.');
    }

    let eventDateOnly = null;
    let eventTimeOnly = null;
    if (event_date) {
      const eventDateTime = new Date(event_date);
      eventDateOnly = eventDateTime.toISOString().split('T')[0];
      eventTimeOnly = eventDateTime.toISOString().split('T')[1].substring(0, 8);
    }

    const result = await query(
      `UPDATE events
       SET event_name = COALESCE($1, event_name),
           description = COALESCE($2, description),
           event_date = COALESCE($3, event_date),
           event_time = COALESCE($4, event_time),
           location = COALESCE($5, location),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING id, class_id, school_id, event_name as title, description, to_char(event_date, 'YYYY-MM-DD') as event_date, event_time, location, created_at, updated_at;`,
      [title, description, eventDateOnly, eventTimeOnly, location, eventId]
    );

    return response(200, { event: result.rows[0] });
  } catch (error: any) {
    console.error('Update event handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for DELETE /api/events/{eventId}
 */
export const deleteEventHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;

    const { eventId } = event.pathParameters || {};

    if (!eventId) {
      return errorResponse(400, 'Event ID required.');
    }

    const eventCheck = await query('SELECT id, class_id FROM events WHERE id = $1', [eventId]);
    if (eventCheck.rows.length === 0) {
      return errorResponse(404, 'Event not found.');
    }

    if (!(await canManageEvent(authUser, eventCheck.rows[0].class_id))) {
      return errorResponse(403, 'Access denied. You can only manage events for your class.');
    }

    const result = await query('DELETE FROM events WHERE id = $1 RETURNING id;', [eventId]);

    return response(200, { message: 'Event deleted successfully.' });
  } catch (error: any) {
    console.error('Delete event handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};
