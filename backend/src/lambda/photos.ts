import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../db.js';
import { dbReady } from './init.js';
import { getAuthUser } from './authUtils.js';
import { S3Client, GetObjectCommand, DeleteObjectCommand, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
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

/** Delete all S3 objects whose key begins with the given prefix (handles pagination). */
export async function deleteS3Folder(prefix: string): Promise<void> {
  let continuationToken: string | undefined;
  do {
    const listResult = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
      ContinuationToken: continuationToken
    }));
    const objects = listResult.Contents ?? [];
    if (objects.length > 0) {
      await s3Client.send(new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: { Objects: objects.map(obj => ({ Key: obj.Key! })), Quiet: true }
      }));
    }
    continuationToken = listResult.IsTruncated ? listResult.NextContinuationToken : undefined;
  } while (continuationToken);
}

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
      ? `photos/${school_id}/${class_id}/${userId}-${photoType}-${suffix}.jpg`
      : `photos/other/${userId}-${photoType}-${suffix}.jpg`;
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

/**
 * Lambda handler for POST /api/users/{userId}/gallery
 * Generate presigned URL for gallery photo upload and store the key.
 */
export const uploadGalleryPhotoHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;
    const { userId } = event.pathParameters || {};

    if (!userId) return errorResponse(400, 'userId required.');

    if (authUser.id !== parseInt(userId, 10) && !authUser.is_admin) {
      return errorResponse(403, 'You can only upload to your own gallery.');
    }

    const countResult = await query(
      'SELECT COUNT(*) FROM gallery_photos WHERE user_id = $1', [userId]
    );
    if (parseInt(countResult.rows[0].count, 10) >= 9) {
      return errorResponse(400, 'Gallery limit of 9 photos reached.');
    }

    const userCheck = await query(
      `SELECT u.id, cu.school_id, cu.class_id FROM users u
       LEFT JOIN class_user cu ON u.id = cu.user_id
       WHERE u.id = $1 LIMIT 1`,
      [userId]
    );
    if (userCheck.rows.length === 0) return errorResponse(404, 'User not found.');

    const { school_id, class_id } = userCheck.rows[0];
    const suffix = Date.now().toString(36);
    const key = school_id && class_id
      ? `photos/${school_id}/${class_id}/${userId}-gallery-${suffix}.jpg`
      : `photos/other/${userId}-gallery-${suffix}.jpg`;

    const putCmd = new PutObjectCommand({ Bucket: bucketName, Key: key, ContentType: 'image/jpeg' });
    const presignedUrl = await getSignedUrl(s3Client, putCmd, { expiresIn: 3600 });

    const insertResult = await query(
      'INSERT INTO gallery_photos (user_id, s3_key) VALUES ($1, $2) RETURNING id',
      [userId, key]
    );

    return response(200, { presignedUrl, key, id: insertResult.rows[0].id });
  } catch (error: any) {
    console.error('Upload gallery photo handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for GET /api/users/{userId}/gallery
 */
export const listGalleryPhotosHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;
    const { userId } = event.pathParameters || {};
    if (!userId) return errorResponse(400, 'userId required.');

    const result = await query(
      'SELECT id, s3_key, created_at FROM gallery_photos WHERE user_id = $1 ORDER BY created_at ASC',
      [userId]
    );

    const photos = await Promise.all(result.rows.map(async (row) => ({
      id: row.id,
      url: await resolvePhotoUrl(row.s3_key),
      created_at: row.created_at
    })));

    return response(200, { photos });
  } catch (error: any) {
    console.error('List gallery photos handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for DELETE /api/users/{userId}/gallery/{photoId}
 */
export const deleteGalleryPhotoHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;
    const { userId, photoId } = event.pathParameters || {};
    if (!userId || !photoId) return errorResponse(400, 'userId and photoId required.');

    if (authUser.id !== parseInt(userId, 10) && !authUser.is_admin) {
      return errorResponse(403, 'You can only delete your own gallery photos.');
    }

    const photoResult = await query(
      'SELECT id, s3_key FROM gallery_photos WHERE id = $1 AND user_id = $2',
      [photoId, userId]
    );
    if (photoResult.rows.length === 0) return errorResponse(404, 'Photo not found.');

    const { s3_key } = photoResult.rows[0];
    await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: s3_key }));
    await query('DELETE FROM gallery_photos WHERE id = $1', [photoId]);

    return response(200, { message: 'Gallery photo deleted.' });
  } catch (error: any) {
    console.error('Delete gallery photo handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};
