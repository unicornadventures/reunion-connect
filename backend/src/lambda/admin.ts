import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../db.js';
import { encodeRegistrationHash } from '../utils/registrationLink.js';
import { dbReady } from './init.js';
import { getAuthUser } from './authUtils.js';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const bucketName = process.env.AWS_S3_BUCKET || 'classyear-dev';

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

/**
 * Lambda handler for GET /api/admin/users
 */
export const getAdminUsersHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');
    if (!authUser.is_admin) return errorResponse(403, 'Admin access required.');

    await dbReady;
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
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');
    if (!authUser.is_admin) return errorResponse(403, 'Admin access required.');

    await dbReady;
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
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');
    if (!authUser.is_admin) return errorResponse(403, 'Admin access required.');

    await dbReady;
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
      `SELECT u.id, u.email, u.is_deceased, p.first_name, p.last_name
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
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');
    if (!authUser.is_admin) return errorResponse(403, 'Admin access required.');

    await dbReady;
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
 * Lambda handler for POST /api/admin/schools/{schoolId}/classes/{classId}/users
 */
export const createUserHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') return response(200, {});
  try {
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');
    if (!authUser.is_admin) return errorResponse(403, 'Admin access required.');

    await dbReady;
    const { schoolId, classId } = event.pathParameters || {};
    const { email, original_first_name, original_last_name, first_name, last_name, is_deceased } =
      JSON.parse(event.body || '{}');

    if (!schoolId || !classId) return errorResponse(400, 'schoolId and classId required.');
    if (!first_name?.trim() || !last_name?.trim()) {
      return errorResponse(400, 'first_name and last_name are required.');
    }

    const resolvedEmail = email?.trim().toLowerCase() || null;

    if (resolvedEmail) {
      const existing = await query('SELECT id FROM users WHERE email = $1', [resolvedEmail]);
      if (existing.rows.length > 0) {
        return errorResponse(409, 'A user with this email already exists.');
      }
    }

    const tempPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);

    const userResult = await query(
      'INSERT INTO users (email, password, is_deceased) VALUES ($1, $2, $3) RETURNING id, email, is_deceased',
      [resolvedEmail, tempPassword, is_deceased ?? false]
    );
    const user = userResult.rows[0];

    await query(
      `INSERT INTO profiles (user_id, first_name, last_name, former_first_name, former_last_name)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, first_name.trim(), last_name.trim(), original_first_name?.trim() || null, original_last_name?.trim() || null]
    );

    await query(
      'INSERT INTO class_user (class_id, user_id, school_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [classId, user.id, schoolId]
    );

    return response(201, { user: { id: user.id, email: user.email, first_name, last_name, is_deceased: user.is_deceased } });
  } catch (error: any) {
    console.error('Create user handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for POST /api/admin/schools/{schoolId}/classes/{classId}/users/import
 */
export const importUsersHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') return response(200, {});
  try {
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');
    if (!authUser.is_admin) return errorResponse(403, 'Admin access required.');

    await dbReady;
    const { schoolId, classId } = event.pathParameters || {};
    const { users } = JSON.parse(event.body || '{}');

    if (!schoolId || !classId) return errorResponse(400, 'schoolId and classId required.');
    if (!Array.isArray(users) || users.length === 0) {
      return errorResponse(400, 'users array is required.');
    }
    if (users.length > 500) {
      return errorResponse(400, 'Maximum 500 users per import.');
    }

    const created: { first_name: string; last_name: string }[] = [];
    const skipped: { index: number; name: string; reason: string }[] = [];

    for (let i = 0; i < users.length; i++) {
      const { email, original_first_name, original_last_name, first_name, last_name } = users[i];

      if (!first_name?.trim() || !last_name?.trim()) {
        skipped.push({ index: i, name: `Row ${i + 1}`, reason: 'Missing first or last name' });
        continue;
      }

      const resolvedEmail = email?.trim().toLowerCase() || null;

      try {
        if (resolvedEmail) {
          const existing = await query('SELECT id FROM users WHERE email = $1', [resolvedEmail]);
          if (existing.rows.length > 0) {
            skipped.push({ index: i, name: `${first_name} ${last_name}`, reason: 'Email already exists' });
            continue;
          }
        }

        const tempPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);

        const userResult = await query(
          'INSERT INTO users (email, password, is_deceased) VALUES ($1, $2, $3) RETURNING id',
          [resolvedEmail, tempPassword, users[i].is_deceased ?? false]
        );

        await query(
          `INSERT INTO profiles (user_id, first_name, last_name, former_first_name, former_last_name)
           VALUES ($1, $2, $3, $4, $5)`,
          [userResult.rows[0].id, first_name.trim(), last_name.trim(),
           original_first_name?.trim() || null, original_last_name?.trim() || null]
        );

        await query(
          'INSERT INTO class_user (class_id, user_id, school_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [classId, userResult.rows[0].id, schoolId]
        );

        created.push({ first_name: first_name.trim(), last_name: last_name.trim() });
      } catch {
        skipped.push({ index: i, name: `${first_name} ${last_name}`, reason: 'Database error' });
      }
    }

    return response(201, { created: created.length, skipped });
  } catch (error: any) {
    console.error('Import users handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for POST /api/admin/registration-links
 */
export const createRegistrationLinkHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');
    if (!authUser.is_admin) return errorResponse(403, 'Admin access required.');

    await dbReady;
    const { classId, schoolId } = JSON.parse(event.body || '{}');

    if (!classId || !schoolId) {
      return errorResponse(400, 'Missing required fields: classId and schoolId.');
    }

    // Verify class is linked to this school
    const classResult = await query(
      `SELECT c.id, c.year FROM classes c
       JOIN class_school cs ON c.id = cs.class_id
       WHERE c.id = $1 AND cs.school_id = $2`,
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
