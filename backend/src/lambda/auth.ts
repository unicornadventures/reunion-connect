import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../db.js';
import { decodeRegistrationHash } from '../utils/registrationLink.js';
import { dbReady } from './init.js';

// Utility to create response objects
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
 * Lambda handler for POST /api/auth/login
 */
export const loginHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    await dbReady;
    const { email, password } = JSON.parse(event.body || '{}');

    if (!email || !password) {
      return errorResponse(400, 'Email and password required.');
    }

    const userResult = await query(
      'SELECT id, email, password, is_admin, is_class_admin FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    const user = userResult.rows[0];
    if (!user || !user.password) {
      return errorResponse(401, 'Invalid credentials.');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return errorResponse(401, 'Invalid credentials.');
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
    const token = jwt.sign(
      { id: user.id, email: user.email, is_admin: user.is_admin, is_class_admin: user.is_class_admin },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return response(200, {
      user: {
        user_id: user.id,
        email: user.email,
        is_admin: user.is_admin,
        is_class_admin: user.is_class_admin
      },
      token
    });
  } catch (error: any) {
    console.error('Login handler error:', error);
    return errorResponse(500, 'Internal server error (auth.ts).');
  }
};

/**
 * Lambda handler for POST /api/auth/register
 */
export const registerHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  return errorResponse(403, 'Registration is currently disabled.');
  try {
    await dbReady;
    const { first_name, last_name, email, password, schoolId, classId } = JSON.parse(event.body || '{}');

    if (!email || !password) {
      return errorResponse(400, 'Email and password are required.');
    }

    if (password.length < 6) {
      return errorResponse(400, 'Password must be at least 6 characters long.');
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existingUser.rows.length > 0) {
      return errorResponse(400, 'Email already registered.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userResult = await query(
      `INSERT INTO users (email, password, is_admin, is_class_admin)
       VALUES ($1, $2, false, false)
       RETURNING id, email, is_admin, is_class_admin;`,
      [normalizedEmail, hashedPassword]
    );

    const newUser = userResult.rows[0];

    // Create profile
    await query(
      `INSERT INTO profiles (user_id, first_name, last_name, bio)
       VALUES ($1, $2, $3, '')`,
      [newUser.id, first_name || null, last_name || null]
    );

    // Auto-enroll in class if schoolId and classId provided
    if (schoolId && classId) {
      const classExists = await query(
        `SELECT c.id FROM classes c
         JOIN class_school cs ON c.id = cs.class_id
         WHERE c.id = $1 AND cs.school_id = $2`,
        [classId, schoolId]
      );
      if (classExists.rows.length > 0) {
        await query(
          `INSERT INTO class_user (class_id, user_id, school_id)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING;`,
          [classId, newUser.id, schoolId]
        );
      }
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, is_admin: newUser.is_admin },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return response(201, {
      message: 'Registration successful. Please verify your email.',
      user: {
        user_id: newUser.id,
        email: newUser.email,
        is_admin: newUser.is_admin,
        is_class_admin: newUser.is_class_admin
      },
      token
    });
  } catch (error: any) {
    console.error('Register handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for GET /api/auth/registration-link/{hash}
 */
export const getRegistrationLinkHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    await dbReady;
    const { hash } = event.pathParameters || {};

    if (!hash) {
      return errorResponse(400, 'Hash parameter required.');
    }

    const decoded = decodeRegistrationHash(hash);
    if (!decoded) {
      return errorResponse(400, 'Invalid registration link.');
    }

    const { schoolId, classId } = decoded;

    // Fetch school and class info
    const schoolResult = await query('SELECT id, name, location FROM schools WHERE id = $1', [schoolId]);
    if (schoolResult.rows.length === 0) {
      return errorResponse(404, 'School not found.');
    }

    const classResult = await query(
      `SELECT c.id, c.year FROM classes c
       JOIN class_school cs ON c.id = cs.class_id
       WHERE c.id = $1 AND cs.school_id = $2`,
      [classId, schoolId]
    );
    if (classResult.rows.length === 0) {
      return errorResponse(404, 'Class not found.');
    }

    return response(200, {
      school: schoolResult.rows[0],
      class: classResult.rows[0]
    });
  } catch (error: any) {
    console.error('Get registration link handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for POST /api/auth/forgot-password
 */
export const forgotPasswordHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    await dbReady;
    const { email } = JSON.parse(event.body || '{}');

    if (!email) {
      return errorResponse(400, 'Email is required.');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const userResult = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);

    // Don't reveal if email exists for security
    if (userResult.rows.length === 0) {
      return response(200, { message: 'If the email exists, a password reset link has been sent.' });
    }

    const user = userResult.rows[0];

    // Delete existing reset tokens
    await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);

    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    await query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, hash, expiresAt]
    );

    return response(200, {
      message: 'If the email exists, a password reset link has been sent.'
    });
  } catch (error: any) {
    console.error('Forgot password handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for POST /api/auth/reset-password
 */
export const resetPasswordHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    await dbReady;
    const { token, password, confirmPassword } = JSON.parse(event.body || '{}');

    if (!token || !password || !confirmPassword) {
      return errorResponse(400, 'Token, password, and password confirmation are required.');
    }

    if (password !== confirmPassword) {
      return errorResponse(400, 'Passwords do not match.');
    }

    if (password.length < 6) {
      return errorResponse(400, 'Password must be at least 6 characters long.');
    }

    // Hash the provided token
    const hash = crypto.createHash('sha256').update(token).digest('hex');

    // Find token in database
    const tokenResult = await query(
      'SELECT user_id FROM password_reset_tokens WHERE token_hash = $1 AND expires_at > NOW()',
      [hash]
    );

    if (tokenResult.rows.length === 0) {
      return errorResponse(400, 'Invalid or expired reset token.');
    }

    const userId = tokenResult.rows[0].user_id;
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user password
    await query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);

    // Delete used token
    await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);

    return response(200, { message: 'Password reset successful.' });
  } catch (error: any) {
    console.error('Reset password handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};
