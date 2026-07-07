import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { query } from '../db.js';
import { dbReady } from './init.js';
import { getAuthUser } from './authUtils.js';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const bucketName = process.env.AWS_S3_BUCKET || 'classyear-dev';

async function deletePhotosFromS3(keys: (string | null)[]) {
  for (const key of keys) {
    if (key) {
      try {
        await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
      } catch (err) {
        console.error(`Failed to delete S3 object ${key}:`, err);
      }
    }
  }
}

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
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;
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
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;
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
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;
    if (!authUser.is_admin) return errorResponse(403, 'Admin access required.');

    const { name, location } = JSON.parse(event.body || '{}');

    if (!name) {
      return errorResponse(400, 'School name is required.');
    }

    await query('BEGIN');

    const result = await query(
      'INSERT INTO schools (name, location) VALUES ($1, $2) RETURNING id, name, location, created_at',
      [name, location || null]
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

    // Collect all users belonging to this school via class_user.school_id
    const usersResult = await query(
      `SELECT DISTINCT u.id, p.then_photo_url, p.now_photo_url
       FROM class_user cu
       JOIN users u ON cu.user_id = u.id
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE cu.school_id = $1`,
      [schoolId]
    );

    // Delete S3 photos for each user
    const photoKeys = usersResult.rows.flatMap(u => [u.then_photo_url, u.now_photo_url]);
    await deletePhotosFromS3(photoKeys);

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
