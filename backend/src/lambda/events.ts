import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../db.js';

const response = (statusCode: number, body: any): APIGatewayProxyResult => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  },
  body: JSON.stringify(body)
});

const errorResponse = (statusCode: number, message: string): APIGatewayProxyResult =>
  response(statusCode, { error: message });

/**
 * Lambda handler for GET /api/classes/{classId}/events
 */
export const listEventsHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { classId } = event.pathParameters || {};

    if (!classId) {
      return errorResponse(400, 'Class ID required.');
    }

    const result = await query(
      `SELECT id, class_id, event_name as title, description, event_date, event_time, location, created_at, updated_at
       FROM events
       WHERE class_id = $1
       ORDER BY event_date DESC;`,
      [classId]
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
    const { eventId } = event.pathParameters || {};

    if (!eventId) {
      return errorResponse(400, 'Event ID required.');
    }

    const result = await query(
      'SELECT id, class_id, event_name as title, description, event_date, event_time, location, created_at, updated_at FROM events WHERE id = $1',
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
 * Lambda handler for POST /api/admin/classes/{classId}/events
 */
export const createEventHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { classId } = event.pathParameters || {};
    const { title, description, event_date, location } = JSON.parse(event.body || '{}');

    if (!classId || !title || !event_date) {
      return errorResponse(400, 'Class ID, title, and event_date are required.');
    }

    // Verify class exists
    const classCheck = await query('SELECT id FROM classes WHERE id = $1', [classId]);
    if (classCheck.rows.length === 0) {
      return errorResponse(404, 'Class not found.');
    }

    // Parse event_date ISO string into date and time components
    const eventDateTime = new Date(event_date);
    const eventDateOnly = eventDateTime.toISOString().split('T')[0];
    const eventTimeOnly = eventDateTime.toISOString().split('T')[1].substring(0, 8);

    const result = await query(
      `INSERT INTO events (class_id, event_name, description, event_date, event_time, location)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, class_id, event_name as title, description, event_date, event_time, location, created_at, updated_at;`,
      [classId, title, description || null, eventDateOnly, eventTimeOnly, location || null]
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
    const { eventId } = event.pathParameters || {};
    const { title, description, event_date, location } = JSON.parse(event.body || '{}');

    if (!eventId) {
      return errorResponse(400, 'Event ID required.');
    }

    // Check if event exists
    const eventCheck = await query('SELECT id FROM events WHERE id = $1', [eventId]);
    if (eventCheck.rows.length === 0) {
      return errorResponse(404, 'Event not found.');
    }

    // Parse event_date ISO string into date and time components if provided
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
       RETURNING id, class_id, event_name as title, description, event_date, event_time, location, created_at, updated_at;`,
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
    const { eventId } = event.pathParameters || {};

    if (!eventId) {
      return errorResponse(400, 'Event ID required.');
    }

    const result = await query('DELETE FROM events WHERE id = $1 RETURNING id;', [eventId]);

    if (result.rows.length === 0) {
      return errorResponse(404, 'Event not found.');
    }

    return response(200, { message: 'Event deleted successfully.' });
  } catch (error: any) {
    console.error('Delete event handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};
