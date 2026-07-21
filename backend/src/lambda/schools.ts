import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../db.js';
import { dbReady } from './init.js';
import { getAuthUser } from './authUtils.js';
import { deleteS3Folder } from './photos.js';


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
 * Lambda handler for GET /api/schools
 */
export const listSchoolsHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    await dbReady;
    const result = await query(`
      SELECT id, name, location, timezone, created_at
      FROM schools
      ORDER BY name ASC;
    `);

    return response(200, { schools: result.rows });
  } catch (error: any) {
    console.error('List schools handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for GET /api/schools/{schoolId}
 */
export const getSchoolHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;
    const { schoolId } = event.pathParameters || {};

    if (!schoolId) {
      return errorResponse(400, 'School ID required.');
    }

    const result = await query('SELECT id, name, location, timezone, created_at FROM schools WHERE id = $1', [schoolId]);

    if (result.rows.length === 0) {
      return errorResponse(404, 'School not found.');
    }

    return response(200, { school: result.rows[0] });
  } catch (error: any) {
    console.error('Get school handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for POST /api/admin/schools
 */
export const createSchoolHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;
    if (!authUser.is_admin) return errorResponse(403, 'Admin access required.');

    const { name, location, timezone } = JSON.parse(event.body || '{}');

    if (!name) {
      return errorResponse(400, 'School name is required.');
    }

    await query('BEGIN');

    const result = await query(
      'INSERT INTO schools (name, location, timezone) VALUES ($1, $2, $3) RETURNING id, name, location, timezone, created_at',
      [name, location || null, timezone || null]
    );

    const school = result.rows[0];

    await query('COMMIT');

    return response(201, { school });
  } catch (error: any) {
    await query('ROLLBACK').catch(() => {});
    console.error('Create school handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for PUT /api/admin/schools/{schoolId}
 */
export const updateSchoolHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;
    if (!authUser.is_admin) return errorResponse(403, 'Admin access required.');

    const { schoolId } = event.pathParameters || {};
    if (!schoolId) return errorResponse(400, 'School ID required.');

    const { name, location, timezone } = JSON.parse(event.body || '{}');

    if (!name) {
      return errorResponse(400, 'School name is required.');
    }

    const result = await query(
      'UPDATE schools SET name = $1, location = $2, timezone = $3, updated_at = NOW() WHERE id = $4 RETURNING id, name, location, timezone, created_at, updated_at',
      [name, location || null, timezone || null, schoolId]
    );

    if (result.rows.length === 0) {
      return errorResponse(404, 'School not found.');
    }

    return response(200, { school: result.rows[0] });
  } catch (error: any) {
    console.error('Update school handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for DELETE /api/admin/schools/{schoolId}
 */
export const deleteSchoolHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: '',
    };
  }
  try {
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;
    if (!authUser.is_admin) return errorResponse(403, 'Admin access required.');

    const { schoolId } = event.pathParameters || {};

    if (!schoolId) {
      return errorResponse(400, 'School ID required.');
    }

    const schoolCheck = await query('SELECT id FROM schools WHERE id = $1', [schoolId]);
    if (schoolCheck.rows.length === 0) {
      return errorResponse(404, 'School not found.');
    }

    // Delete all photos for this school in one S3 prefix sweep
    await deleteS3Folder(`photos/${schoolId}/`);

    // Collect users to delete from DB
    const usersResult = await query(
      `SELECT DISTINCT u.id FROM class_user cu JOIN users u ON cu.user_id = u.id WHERE cu.school_id = $1`,
      [schoolId]
    );

    // Delete all users — cascade removes profiles, comments, tokens
    if (usersResult.rows.length > 0) {
      const userIds = usersResult.rows.map(u => u.id);
      await query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
    }

    // Delete the school — cascade removes classes → class_user, events
    await query('DELETE FROM schools WHERE id = $1', [schoolId]);

    return response(200, { message: 'School deleted successfully.' });
  } catch (error: any) {
    console.error('Delete school handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};
