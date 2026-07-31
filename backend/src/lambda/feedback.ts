import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../db.js';
import { dbReady } from './init.js';
import { getAuthUser } from './authUtils.js';

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

// The whole feedback module can be switched off by setting FEEDBACK_ENABLED=false
const feedbackDisabled = () => process.env.FEEDBACK_ENABLED === 'false';

/**
 * Lambda handler for POST /api/feedback
 */
export const createFeedbackHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (feedbackDisabled()) return errorResponse(404, 'Feedback is not enabled.');

    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;
    const { comment } = JSON.parse(event.body || '{}');

    if (!comment || !String(comment).trim()) {
      return errorResponse(400, 'Comment is required.');
    }

    const result = await query(
      `INSERT INTO feedback (user_id, comment)
       VALUES ($1, $2)
       RETURNING id, user_id, comment, created_at;`,
      [authUser.id, String(comment).trim()]
    );

    return response(201, { feedback: result.rows[0] });
  } catch (error: any) {
    console.error('Create feedback handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for GET /api/feedback — the authenticated user's own feedback only
 */
export const listMyFeedbackHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (feedbackDisabled()) return errorResponse(404, 'Feedback is not enabled.');

    const authUser = getAuthUser(event);
    if (!authUser) return errorResponse(401, 'Authentication required.');

    await dbReady;
    const result = await query(
      `SELECT id, user_id, comment, created_at
       FROM feedback
       WHERE user_id = $1
       ORDER BY created_at DESC;`,
      [authUser.id]
    );

    return response(200, { feedback: result.rows });
  } catch (error: any) {
    console.error('List feedback handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};
