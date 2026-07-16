import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../db.js';
import { dbReady } from './init.js';
import { getAuthUser } from './authUtils.js';
import { resolvePhotoUrl, deleteS3Folder } from './photos.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const response = (statusCode: number, body: any): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', ...corsHeaders },
  body: JSON.stringify(body)
});

const optionsResponse = (): APIGatewayProxyResult => ({
  statusCode: 200,
  headers: corsHeaders,
  body: '',
});

const errorResponse = (statusCode: number, message: string): APIGatewayProxyResult =>
  response(statusCode, { error: message });

/**
 * Lambda handler for GET /api/classes — all seeded class years
 */
export const listAllClassesHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;
    const result = await query('SELECT id, year FROM classes ORDER BY year DESC;');
    return response(200, { classes: result.rows });
  } catch (error: any) {
    console.error('List all classes handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for GET /api/schools/{schoolId}/classes
 */
export const listClassesHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    await dbReady;
    const { schoolId } = event.pathParameters || {};

    if (!schoolId) {
      return errorResponse(400, 'School ID required.');
    }

    const currentYear = new Date().getFullYear();

    // Auto-link the current year for any school that is already set up.
    // This ensures new calendar years are picked up without manual intervention.
    const currentYearLinked = await query(
      `SELECT 1 FROM class_school cs
       JOIN classes c ON cs.class_id = c.id
       WHERE cs.school_id = $1 AND c.year = $2`,
      [schoolId, currentYear]
    );

    if (currentYearLinked.rows.length === 0) {
      // Only auto-link if the school already has at least one year configured
      const hasAny = await query(
        'SELECT 1 FROM class_school WHERE school_id = $1 LIMIT 1',
        [schoolId]
      );
      if (hasAny.rows.length > 0) {
        const classRow = await query('SELECT id FROM classes WHERE year = $1', [currentYear]);
        if (classRow.rows.length > 0) {
          await query(
            'INSERT INTO class_school (class_id, school_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [classRow.rows[0].id, schoolId]
          );
        }
      }
    }

    const result = await query(
      `SELECT c.id, c.year, COUNT(cu.user_id)::int AS member_count
       FROM classes c
       JOIN class_school cs ON c.id = cs.class_id
       LEFT JOIN class_user cu ON c.id = cu.class_id AND cu.school_id = cs.school_id
       WHERE cs.school_id = $1
       GROUP BY c.id, c.year
       ORDER BY c.year DESC;`,
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
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;
    const { classId } = event.pathParameters || {};

    if (!classId) {
      return errorResponse(400, 'Class ID required.');
    }

    const result = await query(
      `SELECT c.id, c.year, cs.school_id, s.name AS school_name, c.created_at
       FROM classes c
       LEFT JOIN class_school cs ON c.id = cs.class_id
       LEFT JOIN schools s ON cs.school_id = s.id
       WHERE c.id = $1
       LIMIT 1;`,
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
 * Lambda handler for POST /api/admin/schools/{schoolId}/classes — link class year to school
 */
export const createClassHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') return optionsResponse();
  try {
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;
    if (!authUser.is_admin) return errorResponse(403, 'Admin access required.');

    const { schoolId } = event.pathParameters || {};
    const { year } = JSON.parse(event.body || '{}');

    if (!schoolId || !year) {
      return errorResponse(400, 'School ID and year are required.');
    }

    const schoolCheck = await query('SELECT id FROM schools WHERE id = $1', [schoolId]);
    if (schoolCheck.rows.length === 0) {
      return errorResponse(404, 'School not found.');
    }

    const classRow = await query('SELECT id, year FROM classes WHERE year = $1', [year]);
    if (classRow.rows.length === 0) {
      return errorResponse(404, `Class year ${year} not found.`);
    }

    const classId = classRow.rows[0].id;

    const existing = await query(
      'SELECT 1 FROM class_school WHERE class_id = $1 AND school_id = $2',
      [classId, schoolId]
    );
    if (existing.rows.length > 0) {
      return errorResponse(409, `Class year ${year} is already linked to this school.`);
    }

    await query('INSERT INTO class_school (class_id, school_id) VALUES ($1, $2)', [classId, schoolId]);

    return response(201, { class: classRow.rows[0] });
  } catch (error: any) {
    console.error('Create class handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for POST /api/admin/schools/{schoolId}/classes/bulk
 */
export const bulkLinkClassesHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') return optionsResponse();
  try {
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;
    if (!authUser.is_admin) return errorResponse(403, 'Admin access required.');

    const { schoolId } = event.pathParameters || {};
    const { startYear } = JSON.parse(event.body || '{}');
    const currentYear = new Date().getFullYear();

    if (!schoolId) return errorResponse(400, 'School ID required.');
    if (!startYear || startYear < 1950 || startYear > currentYear) {
      return errorResponse(400, `startYear must be between 1950 and ${currentYear}.`);
    }

    const schoolCheck = await query('SELECT id FROM schools WHERE id = $1', [schoolId]);
    if (schoolCheck.rows.length === 0) return errorResponse(404, 'School not found.');

    const classRows = await query(
      'SELECT id, year FROM classes WHERE year >= $1 AND year <= $2 ORDER BY year DESC;',
      [startYear, currentYear]
    );

    for (const row of classRows.rows) {
      await query(
        'INSERT INTO class_school (class_id, school_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;',
        [row.id, schoolId]
      );
    }

    const linked = await query(
      `SELECT c.id, c.year, COUNT(cu.user_id)::int AS member_count
       FROM classes c
       JOIN class_school cs ON c.id = cs.class_id
       LEFT JOIN class_user cu ON c.id = cu.class_id AND cu.school_id = cs.school_id
       WHERE cs.school_id = $1
       GROUP BY c.id, c.year
       ORDER BY c.year DESC;`,
      [schoolId]
    );

    return response(201, { classes: linked.rows });
  } catch (error: any) {
    console.error('Bulk link classes handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for DELETE /api/admin/schools/{schoolId}/classes/{classId}
 */
export const deleteClassHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') return optionsResponse();
  try {
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;
    if (!authUser.is_admin) return errorResponse(403, 'Admin access required.');

    const { schoolId, classId } = event.pathParameters || {};
    const cascadeUsers = event.queryStringParameters?.cascadeUsers === 'true';

    if (!schoolId || !classId) {
      return errorResponse(400, 'School ID and Class ID required.');
    }

    const linkCheck = await query(
      'SELECT 1 FROM class_school WHERE class_id = $1 AND school_id = $2',
      [classId, schoolId]
    );
    if (linkCheck.rows.length === 0) {
      return errorResponse(404, 'Class is not linked to this school.');
    }

    if (cascadeUsers) {
      // Delete all photos for this class in one S3 prefix sweep
      await deleteS3Folder(`photos/${schoolId}/${classId}/`);

      const usersResult = await query(
        `SELECT u.id FROM class_user cu JOIN users u ON cu.user_id = u.id
         WHERE cu.class_id = $1 AND cu.school_id = $2`,
        [classId, schoolId]
      );

      if (usersResult.rows.length > 0) {
        const userIds = usersResult.rows.map(u => u.id);
        await query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
      }
    } else {
      await query(
        'DELETE FROM class_user WHERE class_id = $1 AND school_id = $2',
        [classId, schoolId]
      );
    }

    await query('DELETE FROM class_school WHERE class_id = $1 AND school_id = $2', [classId, schoolId]);

    return response(200, { message: 'Class unlinked from school successfully.' });
  } catch (error: any) {
    console.error('Delete class handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for GET /api/classes/{classId}/directory
 */
export const getClassDirectoryHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;
    const { classId } = event.pathParameters || {};

    if (!classId) return errorResponse(400, 'Class ID required.');

    // Membership is checked against the token identity, not a client-supplied id
    if (!authUser.is_admin) {
      const memberCheck = await query(
        'SELECT class_id FROM class_user WHERE user_id = $1 AND class_id = $2',
        [authUser.id, classId]
      );
      if (memberCheck.rows.length === 0) {
        return errorResponse(403, 'Access denied. You are not in this class.');
      }
    }

    const result = await query(
      `SELECT
         u.id,
         u.email,
         u.is_deceased,
         p.first_name,
         p.last_name,
         p.nickname,
         p.former_first_name,
         p.former_last_name,
         p.now_photo_url,
         p.then_photo_url,
         p.tags
       FROM class_user cu
       JOIN users u ON cu.user_id = u.id
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE cu.class_id = $1
       ORDER BY p.last_name ASC, p.first_name ASC;`,
      [classId]
    );

    const users = await Promise.all(result.rows.map(async (row) => ({
      ...row,
      now_photo_url: await resolvePhotoUrl(row.now_photo_url),
      then_photo_url: await resolvePhotoUrl(row.then_photo_url)
    })));

    return response(200, { users });
  } catch (error: any) {
    console.error('Get class directory handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for GET /api/classes/{classId}/members
 */
export const getClassMembersHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;
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
