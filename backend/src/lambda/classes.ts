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
 * Lambda handler for GET /api/schools/{schoolId}/classes
 */
export const listClassesHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { schoolId } = event.pathParameters || {};

    if (!schoolId) {
      return errorResponse(400, 'School ID required.');
    }

    const result = await query(
      'SELECT id, school_id, year, created_at FROM classes WHERE school_id = $1 ORDER BY year DESC;',
      [schoolId]
    );

    return response(200, { classes: result.rows });
  } catch (error: any) {
    console.error('List classes handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for GET /api/classes/{classId}
 */
export const getClassHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { classId } = event.pathParameters || {};

    if (!classId) {
      return errorResponse(400, 'Class ID required.');
    }

    const result = await query(
      'SELECT id, school_id, year, created_at FROM classes WHERE id = $1',
      [classId]
    );

    if (result.rows.length === 0) {
      return errorResponse(404, 'Class not found.');
    }

    return response(200, { class: result.rows[0] });
  } catch (error: any) {
    console.error('Get class handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for POST /api/admin/schools/{schoolId}/classes
 */
export const createClassHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { schoolId } = event.pathParameters || {};
    const { year } = JSON.parse(event.body || '{}');

    if (!schoolId || !year) {
      return errorResponse(400, 'School ID and year are required.');
    }

    // Verify school exists
    const schoolCheck = await query('SELECT id FROM schools WHERE id = $1', [schoolId]);
    if (schoolCheck.rows.length === 0) {
      return errorResponse(404, 'School not found.');
    }

    const result = await query(
      'INSERT INTO classes (school_id, year) VALUES ($1, $2) RETURNING id, school_id, year, created_at',
      [schoolId, year]
    );

    return response(201, { class: result.rows[0] });
  } catch (error: any) {
    console.error('Create class handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for GET /api/classes/{classId}/members
 */
export const getClassMembersHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { classId } = event.pathParameters || {};

    if (!classId) {
      return errorResponse(400, 'Class ID required.');
    }

    const result = await query(
      `SELECT u.id, u.email, p.first_name, p.last_name
       FROM class_user cu
       JOIN users u ON cu.user_id = u.id
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE cu.class_id = $1
       ORDER BY p.last_name ASC, p.first_name ASC;`,
      [classId]
    );

    return response(200, { members: result.rows });
  } catch (error: any) {
    console.error('Get class members handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};
