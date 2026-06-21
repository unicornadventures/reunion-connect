import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { query } from '../db.js';
import { encodeRegistrationHash } from '../utils/registrationLink.js';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const bucketName = process.env.AWS_S3_BUCKET || 'classyear-dev';

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
 * Lambda handler for GET /api/admin/users
 */
export const getAdminUsersHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const result = await query(`
      SELECT
        u.id,
        u.email,
        u.is_admin,
        u.is_class_admin,
        u.created_at,
        p.first_name,
        p.last_name
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      ORDER BY u.created_at DESC;
    `);

    return response(200, { users: result.rows });
  } catch (error: any) {
    console.error('Get admin users handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for DELETE /api/admin/users/{userId}
 */
export const deleteUserHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = event.pathParameters || {};

    if (!userId) {
      return errorResponse(400, 'User ID required.');
    }

    const userCheck = await query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return errorResponse(404, 'User not found.');
    }

    // Delete S3 photos before removing the user
    const profileResult = await query(
      'SELECT then_photo_url, now_photo_url FROM profiles WHERE user_id = $1',
      [userId]
    );
    if (profileResult.rows.length > 0) {
      const { then_photo_url, now_photo_url } = profileResult.rows[0];
      for (const key of [then_photo_url, now_photo_url]) {
        if (key) {
          try {
            await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
          } catch (err) {
            console.error(`Failed to delete S3 object ${key}:`, err);
          }
        }
      }
    }

    // Delete user — cascade removes profile, comments, tokens
    await query('DELETE FROM users WHERE id = $1', [userId]);

    return response(200, { message: 'User deleted successfully.' });
  } catch (error: any) {
    console.error('Delete user handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for GET /api/admin/classes/{classId}/users
 */
export const getClassUsersHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { classId } = event.pathParameters || {};
    const page = parseInt(event.queryStringParameters?.page || '1', 10);
    const pageSize = parseInt(event.queryStringParameters?.pageSize || '10', 10);
    const lastName = (event.queryStringParameters?.lastName || '').trim();

    if (!classId) {
      return errorResponse(400, 'Class ID required.');
    }

    // Build WHERE clause
    let whereClause = 'cu.class_id = $1';
    const params: any[] = [classId];

    if (lastName) {
      whereClause += ` AND p.last_name ILIKE $${params.length + 1}`;
      params.push(`${lastName}%`);
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as count FROM class_user cu
       JOIN users u ON cu.user_id = u.id
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    const offset = (page - 1) * pageSize;
    const result = await query(
      `SELECT u.id, u.email, p.first_name, p.last_name
       FROM class_user cu
       JOIN users u ON cu.user_id = u.id
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE ${whereClause}
       ORDER BY p.last_name ASC, p.first_name ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    );

    return response(200, { users: result.rows, total, page, pageSize });
  } catch (error: any) {
    console.error('Get class users handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for PUT /api/admin/users/{userId}
 */
export const updateUserClassAdminHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = event.pathParameters || {};
    const { is_class_admin } = JSON.parse(event.body || '{}');

    if (!userId || is_class_admin === undefined) {
      return errorResponse(400, 'Missing required fields.');
    }

    const userIdNum = parseInt(userId);

    // Verify user exists
    const userResult = await query('SELECT id, is_class_admin FROM users WHERE id = $1', [userIdNum]);
    if (userResult.rows.length === 0) {
      return errorResponse(404, 'User not found.');
    }

    // Update user's class admin status
    const updateResult = await query(
      'UPDATE users SET is_class_admin = $1 WHERE id = $2 RETURNING id, email, is_admin, is_class_admin',
      [is_class_admin, userIdNum]
    );

    return response(200, { user: updateResult.rows[0] });
  } catch (error: any) {
    console.error('Update user class admin handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for POST /api/admin/registration-links
 */
export const createRegistrationLinkHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { classId, schoolId } = JSON.parse(event.body || '{}');

    if (!classId || !schoolId) {
      return errorResponse(400, 'Missing required fields: classId and schoolId.');
    }

    // Verify class exists
    const classResult = await query(
      'SELECT id, year FROM classes WHERE id = $1 AND school_id = $2',
      [classId, schoolId]
    );

    if (classResult.rows.length === 0) {
      return errorResponse(404, 'Class not found.');
    }

    // Generate hash
    const hash = encodeRegistrationHash(schoolId, classId);
    const registrationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/register/${hash}`;

    return response(200, {
      hash,
      registrationUrl,
      class: classResult.rows[0]
    });
  } catch (error: any) {
    console.error('Create registration link handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};
