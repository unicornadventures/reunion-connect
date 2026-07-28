import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import crypto from 'crypto';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { dataApiQuery, toPgTimestamp } from '../utils/dataApiDb.js';

const sqsClient = new SQSClient({ region: process.env.AWS_REGION ?? 'us-east-1' });

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
 * Lambda handler for POST /api/auth/forgot-password
 *
 * Deliberately kept out of auth.ts and importing nothing from init.js/db.ts:
 * this function runs outside the VPC and talks to Postgres via the RDS Data
 * API instead of a direct pg connection, so it can also reach SQS/SES over
 * normal internet egress without paying for VPC interface endpoints. Pulling
 * in init.js's dbReady (a direct pg connection) would make every cold start
 * waste time on a doomed connection attempt from outside the VPC. The actual
 * email send happens in emailWorker.ts, triggered by the SQS message
 * enqueued below.
 */
export const forgotPasswordHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { email } = JSON.parse(event.body || '{}');

    if (!email) {
      return errorResponse(400, 'Email is required.');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const userResult = await dataApiQuery('SELECT id FROM users WHERE email = :email', [
      { name: 'email', value: normalizedEmail }
    ]);

    // Don't reveal if email exists for security
    if (userResult.length === 0) {
      return response(200, { message: 'If the email exists, a password reset link has been sent.' });
    }

    const userId = userResult[0].id;

    // Delete existing reset tokens
    await dataApiQuery('DELETE FROM password_reset_tokens WHERE user_id = :userId', [
      { name: 'userId', value: userId }
    ]);

    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    await dataApiQuery(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (:userId, :tokenHash, :expiresAt)',
      [
        { name: 'userId', value: userId },
        { name: 'tokenHash', value: hash },
        { name: 'expiresAt', value: toPgTimestamp(expiresAt), typeHint: 'TIMESTAMP' }
      ]
    );

    await sqsClient.send(new SendMessageCommand({
      QueueUrl: process.env.PASSWORD_RESET_QUEUE_URL,
      MessageBody: JSON.stringify({ email: normalizedEmail, token })
    }));

    return response(200, {
      message: 'If the email exists, a password reset link has been sent.'
    });
  } catch (error: any) {
    console.error('Forgot password handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};
