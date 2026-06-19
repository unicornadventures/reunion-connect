import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://localhost:4566';
const BUCKET_NAME = 'class-reunion-photos'; // Define a standard bucket name

// Helper function to generate a mock pre-signed URL for file upload
// NOTE: In a real setup, this would use the AWS SDK to generate a proper pre-signed URL.
// For Localstack simulation, we are mocking the interaction for structural completeness.
export async function generatePresignedUrl(userId: number, fileName: string): Promise<string> {
  console.log(`[S3] Generating mock pre-signed URL for user ${userId} and file ${fileName}.`);
  
  // Mock response structure: API Gateway/Lambda requires a URL to complete the upload.
  // We simulate the interaction with the Localstack endpoint.
  const mockUrl = `http://${S3_ENDPOINT}/bucket/${BUCKET_NAME}/mock_upload/${fileName}`;
  
  // In a real scenario, this would call the AWS SDK's getPresignedUrl method.
  return mockUrl;
}

/**
 * Updates the user's photo URL in the database after a successful S3 upload.
 * @param userId The ID of the user whose photo was updated.
 * @param url The final URL provided by S3.
 */
export async function updatePhotoUrlInDatabase(userId: number, url: string, photoType: 'then' | 'now'): Promise<void> {
    const fieldName = photoType === 'then' ? 'then_photo_url' : 'now_photo_url';
    
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