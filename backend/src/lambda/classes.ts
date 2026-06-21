import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { query } from '../db.js';

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
    const { schoolId } = event.pathParameters || {};

    if (!schoolId) {
      return errorResponse(400, 'School ID required.');
    }

    const result = await query(
      `SELECT c.id, c.year
       FROM classes c
       JOIN class_school cs ON c.id = cs.class_id
       WHERE cs.school_id = $1
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
 * Lambda handler for DELETE /api/admin/schools/{schoolId}/classes/{classId}
 */
export const deleteClassHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') return optionsResponse();
  try {
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
      const usersResult = await query(
        `SELECT u.id, p.then_photo_url, p.now_photo_url
         FROM class_user cu
         JOIN users u ON cu.user_id = u.id
         LEFT JOIN profiles p ON u.id = p.user_id
         WHERE cu.class_id = $1 AND cu.school_id = $2`,
        [classId, schoolId]
      );

      const photoKeys = usersResult.rows.flatMap(u => [u.then_photo_url, u.now_photo_url]);
      await deletePhotosFromS3(photoKeys);

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
