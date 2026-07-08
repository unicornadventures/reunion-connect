import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../db.js';
import { dbReady } from './init.js';
import { getAuthUser } from './authUtils.js';
import { S3Client, GetObjectCommand, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const bucketName = process.env.S3_BUCKET_NAME || 'classyear-dev';

/** Convert an S3 key stored in the DB to a short-lived presigned GET URL, or return null. */
export async function resolvePhotoUrl(key: string | null | undefined): Promise<string | null> {
  if (!key) return null;
  const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

/**
 * Lambda handler for POST /api/users/{userId}/photo/{photoType}
 * Generates presigned URL for photo upload
 */
export const uploadPhotoHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;
    const { userId, photoType } = event.pathParameters || {};

    if (!userId || !photoType || !['then', 'now'].includes(photoType)) {
      return errorResponse(400, 'Valid userId and photoType (then/now) required.');
    }

    if (authUser.id !== parseInt(userId, 10) && !authUser.is_admin) {
      return errorResponse(403, 'You can only manage your own photos.');
    }

    // Verify user exists and get their school/class for S3 path
    const userCheck = await query(
      `SELECT u.id, cu.school_id, cu.class_id
       FROM users u
       LEFT JOIN class_user cu ON u.id = cu.user_id
       WHERE u.id = $1
       LIMIT 1`,
      [userId]
    );
    if (userCheck.rows.length === 0) {
      return errorResponse(404, 'User not found.');
    }

    const { school_id, class_id } = userCheck.rows[0];
    const suffix = Date.now().toString(36);
    const key = school_id && class_id
      ? `${school_id}/${class_id}/${userId}-${photoType}-${suffix}.jpg`
      : `photos/${userId}/${photoType}-${suffix}.jpg`;
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: 'image/jpeg'
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    // Store the key in the database
    const columnName = `${photoType}_photo_url`;
    await query(`UPDATE profiles SET ${columnName} = $1 WHERE user_id = $2`, [key, userId]);

    return response(200, { presignedUrl, key });
  } catch (error: any) {
    console.error('Upload photo handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for DELETE /api/users/{userId}/photo/{photoType}
 */
export const deletePhotoHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;
    const { userId, photoType } = event.pathParameters || {};

    if (!userId || !photoType || !['then', 'now'].includes(photoType)) {
      return errorResponse(400, 'Valid userId and photoType (then/now) required.');
    }

    if (authUser.id !== parseInt(userId, 10) && !authUser.is_admin) {
      return errorResponse(403, 'You can only manage your own photos.');
    }

    // Get current photo URL
    const profileResult = await query(
      `SELECT ${photoType}_photo_url FROM profiles WHERE user_id = $1`,
      [userId]
    );

    if (profileResult.rows.length === 0) {
      return errorResponse(404, 'User profile not found.');
    }

    const photoUrl = profileResult.rows[0][`${photoType}_photo_url`];

    if (photoUrl) {
      // Delete from S3
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: photoUrl
      });
      await s3Client.send(command);
    }

    // Clear URL from database
    const columnName = `${photoType}_photo_url`;
    await query(`UPDATE profiles SET ${columnName} = NULL WHERE user_id = $1`, [userId]);

    return response(200, { message: 'Photo deleted successfully.' });
  } catch (error: any) {
    console.error('Delete photo handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for GET /api/photos/{photoKey}/presigned
 * Get presigned URL to view a photo
 */
export const getPhotoPresignedUrlHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;
    const photoKey = event.queryStringParameters?.key;

    if (!photoKey) {
      return errorResponse(400, 'Photo key required.');
    }

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: photoKey
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return response(200, { presignedUrl });
  } catch (error: any) {
    console.error('Get presigned URL handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};
