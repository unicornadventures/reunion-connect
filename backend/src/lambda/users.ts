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
 * Lambda handler for GET /api/users/{userId}
 */
export const getProfileHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = event.pathParameters || {};

    if (!userId) {
      return errorResponse(400, 'User ID required.');
    }

    const userResult = await query(
      `SELECT u.id, u.email, u.is_admin, u.is_class_admin,
              p.first_name, p.last_name, p.nickname, p.former_first_name, p.former_last_name,
              p.bio, p.then_photo_url, p.now_photo_url
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE u.id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return errorResponse(404, 'User not found.');
    }

    const row = userResult.rows[0];
    return response(200, {
      user: {
        user_id: row.id,
        email: row.email,
        is_admin: row.is_admin,
        is_class_admin: row.is_class_admin
      },
      profile: {
        first_name: row.first_name,
        last_name: row.last_name,
        nickname: row.nickname,
        former_first_name: row.former_first_name,
        former_last_name: row.former_last_name,
        bio: row.bio,
        then_photo_url: row.then_photo_url,
        now_photo_url: row.now_photo_url
      }
    });
  } catch (error: any) {
    console.error('Get profile handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for PUT /api/users/{userId}/profile
 */
export const updateProfileHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = event.pathParameters || {};
    const { first_name, last_name, nickname, former_first_name, former_last_name, bio, email } = JSON.parse(event.body || '{}');

    if (!userId) {
      return errorResponse(400, 'User ID required.');
    }

    // Update email if provided
    if (email) {
      const existingEmail = await query('SELECT id FROM users WHERE email = $1 AND id != $2', [email.toLowerCase().trim(), userId]);
      if (existingEmail.rows.length > 0) {
        return errorResponse(400, 'Email already in use.');
      }
      await query('UPDATE users SET email = $1 WHERE id = $2', [email.toLowerCase().trim(), userId]);
    }

    // Update profile
    await query(
      `UPDATE profiles SET
         first_name        = COALESCE($1, first_name),
         last_name         = COALESCE($2, last_name),
         nickname          = COALESCE($3, nickname),
         former_first_name = COALESCE($4, former_first_name),
         former_last_name  = COALESCE($5, former_last_name),
         bio               = COALESCE($6, bio)
       WHERE user_id = $7`,
      [first_name, last_name, nickname, former_first_name, former_last_name, bio, userId]
    );

    // Fetch updated profile
    const result = await query(
      `SELECT u.id, u.email, u.is_admin, u.is_class_admin,
              p.first_name, p.last_name, p.nickname, p.former_first_name, p.former_last_name,
              p.bio, p.then_photo_url, p.now_photo_url
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return errorResponse(404, 'User not found.');
    }

    const row = result.rows[0];
    return response(200, {
      user: {
        user_id: row.id,
        email: row.email,
        is_admin: row.is_admin,
        is_class_admin: row.is_class_admin
      },
      profile: {
        first_name: row.first_name,
        last_name: row.last_name,
        nickname: row.nickname,
        former_first_name: row.former_first_name,
        former_last_name: row.former_last_name,
        bio: row.bio,
        then_photo_url: row.then_photo_url,
        now_photo_url: row.now_photo_url
      }
    });
  } catch (error: any) {
    console.error('Update profile handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for GET /api/users/{userId}/class
 */
export const getUserClassHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = event.pathParameters || {};

    if (!userId) {
      return errorResponse(400, 'User ID required.');
    }

    const result = await query(
      `SELECT c.id, c.year, c.school_id, s.name as school_name, s.location
       FROM class_user cu
       JOIN classes c ON cu.class_id = c.id
       JOIN schools s ON c.school_id = s.id
       WHERE cu.user_id = $1
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return errorResponse(404, 'User not in any class.');
    }

    return response(200, { class: result.rows[0] });
  } catch (error: any) {
    console.error('Get user class handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for GET /api/users (directory list)
 */
export const listUsersHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const page = parseInt(event.queryStringParameters?.page || '1', 10);
    const pageSize = parseInt(event.queryStringParameters?.pageSize || '20', 10);
    const offset = (page - 1) * pageSize;

    // Get total count
    const countResult = await query('SELECT COUNT(*) as count FROM users');
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    const result = await query(
      `SELECT u.id, u.email, u.created_at, p.first_name, p.last_name
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    return response(200, {
      users: result.rows,
      total,
      page,
      pageSize
    });
  } catch (error: any) {
    console.error('List users handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};
