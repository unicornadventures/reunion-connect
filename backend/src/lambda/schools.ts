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
 * Lambda handler for GET /api/schools
 */
export const listSchoolsHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const result = await query(`
      SELECT id, name, location, created_at
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
    const { schoolId } = event.pathParameters || {};

    if (!schoolId) {
      return errorResponse(400, 'School ID required.');
    }

    const result = await query('SELECT id, name, location, created_at FROM schools WHERE id = $1', [schoolId]);

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
    const { name, location } = JSON.parse(event.body || '{}');

    if (!name) {
      return errorResponse(400, 'School name is required.');
    }

    const result = await query(
      'INSERT INTO schools (name, location) VALUES ($1, $2) RETURNING id, name, location, created_at',
      [name, location || null]
    );

    return response(201, { school: result.rows[0] });
  } catch (error: any) {
    console.error('Create school handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};
