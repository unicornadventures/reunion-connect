import axios from 'axios';
import dotenv from 'dotenv';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

dotenv.config();

const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://localhost:4566';
const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const s3Client = new S3Client({
  endpoint: S3_ENDPOINT,
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  },
  forcePathStyle: true,
});

export async function generatePresignedUrl(userId: number, fileName: string): Promise<string> {
  console.log(`[S3] Generating presigned URL for user ${userId} and file ${fileName}.`);

  const key = `photos/${userId}/${fileName}`;
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  try {
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    console.log(`[S3] Successfully generated presigned URL for ${key}.`);
    return signedUrl;
  } catch (error) {
    console.error(`[S3] Failed to generate presigned URL for ${key}:`, error);
    throw new Error('Failed to generate presigned URL.');
  }
}

export async function uploadFileToS3(userId: number, fileName: string, fileBuffer: Buffer): Promise<string> {
  console.log(`[S3] Uploading file ${fileName} for user ${userId}.`);

  const key = `photos/${userId}/${fileName}`;
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
  });

  try {
    await s3Client.send(command);
    console.log(`[S3] Successfully uploaded ${key} to S3.`);

    // Generate a public URL for the file
    const publicUrl = `${S3_ENDPOINT}/${BUCKET_NAME}/${key}`;
    return publicUrl;
  } catch (error) {
    console.error(`[S3] Failed to upload file ${key}:`, error);
    throw new Error('Failed to upload file to S3.');
  }
}

/** Deletes a single then/now photo from S3, given the full URL stored in the DB. */
export async function deletePhotoFromS3(photoUrl: string): Promise<void> {
  const key = photoUrl.split(`/${BUCKET_NAME}/`)[1];
  if (!key) return;

  console.log(`[S3] Deleting photo ${key}.`);
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    console.log(`[S3] Deleted photo ${key}.`);
  } catch (error) {
    console.error(`[S3] Failed to delete photo ${key}:`, error);
    throw new Error('Failed to delete photo from S3.');
  }
}

export async function deleteUserPhotosFromS3(userId: number): Promise<void> {
  console.log(`[S3] Deleting all photos for user ${userId}.`);

  try {
    // List all objects in the user's photo directory
    const { query } = await import('./db');

    // Get the user's photo URLs from the database
    const profileResult = await query(
      `SELECT then_photo_url, now_photo_url FROM profiles WHERE user_id = $1`,
      [userId]
    );

    if (profileResult.rows.length === 0) {
      console.log(`[S3] No profile found for user ${userId}, nothing to delete.`);
      return;
    }

    const profile = profileResult.rows[0];
    const photoUrls = [profile.then_photo_url, profile.now_photo_url].filter(Boolean);

    // Delete each photo from S3
    for (const photoUrl of photoUrls) {
      if (!photoUrl) continue;

      // Extract the key from the URL
      // URL format: http://127.0.0.1:4566/class-reunion-photos/photos/userId/filename
      const key = photoUrl.split(`/${BUCKET_NAME}/`)[1];
      if (!key) continue;

      const deleteCommand = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      try {
        await s3Client.send(deleteCommand);
        console.log(`[S3] Deleted photo ${key} for user ${userId}.`);
      } catch (deleteError) {
        console.error(`[S3] Failed to delete photo ${key}:`, deleteError);
        // Continue with other photos even if one fails
      }
    }

    console.log(`[S3] Completed photo deletion for user ${userId}.`);
  } catch (error) {
    console.error(`[S3] Error during photo cleanup for user ${userId}:`, error);
    // Don't throw - we still want to delete the user even if S3 cleanup fails
  }
}

/**
 * Updates the user's photo URL in the database after a successful S3 upload.
 * @param userId The ID of the user whose photo was updated.
 * @param url The final URL provided by S3.
 * @param photoType Then or Now
 */
export async function updatePhotoUrlInDatabase(
    userId: number,
    url: string,
    photoType: 'then' | 'now'
  ): Promise<void> {
    const fieldName
      = photoType === 'then' ? 'then_photo_url' : 'now_photo_url';

    console.log(`[DB] Updating ${fieldName} for user ${userId} with URL: ${url}`);

    // This assumes we have access to the 'query' function from './db'
    const { query } = await import('./db');

    try {
        await query(
            `UPDATE users SET ${fieldName} = $1 WHERE user_id = $2`,
            [url, userId]
        );
        console.log(`[DB] Successfully updated ${photoType} photo URL for user ${userId}.`);
    } catch (error) {
        console.error(`[DB] Failed to update photo URL for user ${userId}:`, error);
        throw new Error('Failed to update database record.');
    }
}
