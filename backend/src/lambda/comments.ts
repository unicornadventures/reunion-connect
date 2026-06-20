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

// Helper: Check if user can moderate comments
async function canModerateComments(userId: number, commenterId: number, targetUserId: number): Promise<boolean> {
  // Profile owner can moderate comments on their profile
  if (userId === targetUserId) return true;

  // Super admin can moderate any comment
  const userResult = await query('SELECT is_admin, is_class_admin FROM users WHERE id = $1', [userId]);
  if (userResult.rows.length === 0) return false;

  const user = userResult.rows[0];
  if (user.is_admin) return true;

  // Class admin can only moderate comments created by users in their class
  if (user.is_class_admin) {
    const sameClassResult = await query(
      `SELECT cu1.class_id
       FROM class_user cu1
       WHERE cu1.user_id = $1
       AND cu1.class_id IN (
         SELECT cu2.class_id FROM class_user cu2 WHERE cu2.user_id = $2
       )`,
      [userId, commenterId]
    );
    return sameClassResult.rows.length > 0;
  }

  return false;
}

/**
 * Lambda handler for POST /api/users/{targetUserId}/comments
 */
export const createCommentHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { targetUserId } = event.pathParameters || {};
    const { commenterId, content } = JSON.parse(event.body || '{}');

    if (!targetUserId || !commenterId || !content) {
      return errorResponse(400, 'Missing required fields.');
    }

    // Verify both users exist
    const targetUserCheck = await query('SELECT id FROM users WHERE id = $1', [targetUserId]);
    const commenterCheck = await query('SELECT id FROM users WHERE id = $1', [commenterId]);

    if (targetUserCheck.rows.length === 0 || commenterCheck.rows.length === 0) {
      return errorResponse(404, 'User not found.');
    }

    const result = await query(
      `INSERT INTO comments (target_user_id, commenter_id, content, published)
       VALUES ($1, $2, $3, false)
       RETURNING id, target_user_id, commenter_id, content, published, created_at, updated_at;`,
      [targetUserId, commenterId, content]
    );

    return response(201, { comment: result.rows[0] });
  } catch (error: any) {
    console.error('Create comment handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for GET /api/users/{targetUserId}/comments
 */
export const getCommentsHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { targetUserId } = event.pathParameters || {};

    if (!targetUserId) {
      return errorResponse(400, 'Target user ID required.');
    }

    const result = await query(
      `SELECT id, target_user_id, commenter_id, content, published, created_at, updated_at
       FROM comments
       WHERE target_user_id = $1 AND published = true
       ORDER BY created_at DESC;`,
      [targetUserId]
    );

    return response(200, { comments: result.rows });
  } catch (error: any) {
    console.error('Get comments handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for GET /api/users/{targetUserId}/comments/pending
 */
export const getPendingCommentsHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { targetUserId } = event.pathParameters || {};
    const requesterId = event.queryStringParameters?.requesterId;

    if (!targetUserId || !requesterId) {
      return errorResponse(400, 'targetUserId and requesterId required.');
    }

    const requesterIdNum = parseInt(String(requesterId));
    const targetUserIdNum = parseInt(String(targetUserId));

    // Get all comments for this profile
    const result = await query(
      `SELECT id, target_user_id, commenter_id, content, published, created_at, updated_at
       FROM comments
       WHERE target_user_id = $1
       ORDER BY published ASC, created_at DESC;`,
      [targetUserIdNum]
    );

    // Filter comments based on authorization for each one
    const authorizedComments = [];
    for (const comment of result.rows) {
      const isAuthorized = await canModerateComments(requesterIdNum, comment.commenter_id, targetUserIdNum);
      if (isAuthorized) {
        authorizedComments.push(comment);
      }
    }

    return response(200, { comments: authorizedComments });
  } catch (error: any) {
    console.error('Get pending comments handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for PUT /api/comments/{commentId}
 */
export const updateCommentHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { commentId } = event.pathParameters || {};
    const { content, published, requesterId } = JSON.parse(event.body || '{}');

    if (!commentId) {
      return errorResponse(400, 'Comment ID required.');
    }

    if (content === undefined && published === undefined) {
      return errorResponse(400, 'At least one of content or published is required.');
    }

    // Get the comment to find its target user
    const commentResult = await query(
      'SELECT id, target_user_id, commenter_id FROM comments WHERE id = $1',
      [commentId]
    );

    if (commentResult.rows.length === 0) {
      return errorResponse(404, 'Comment not found.');
    }

    const comment = commentResult.rows[0];

    // If trying to publish/unpublish, check authorization
    if (published !== undefined && requesterId) {
      const requesterIdNum = parseInt(String(requesterId));
      const isAuthorized = await canModerateComments(requesterIdNum, comment.commenter_id, comment.target_user_id);
      if (!isAuthorized) {
        return errorResponse(403, 'Not authorized to moderate this comment.');
      }
    }

    // If editing content, only commenter can do it
    if (content !== undefined && requesterId) {
      const requesterIdNum = parseInt(String(requesterId));
      if (requesterIdNum !== comment.commenter_id) {
        return errorResponse(403, 'You can only edit your own comments.');
      }
    }

    let updateFields = [];
    let params: any[] = [];
    let paramCount = 1;

    if (content !== undefined) {
      updateFields.push(`content = $${paramCount++}`);
      params.push(content);
    }

    if (published !== undefined) {
      updateFields.push(`published = $${paramCount++}`);
      params.push(published);
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(commentId);

    const result = await query(
      `UPDATE comments
       SET ${updateFields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, target_user_id, commenter_id, content, published, created_at, updated_at;`,
      params
    );

    if (result.rows.length === 0) {
      return errorResponse(404, 'Comment not found.');
    }

    return response(200, { comment: result.rows[0] });
  } catch (error: any) {
    console.error('Update comment handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};

/**
 * Lambda handler for DELETE /api/comments/{commentId}
 */
export const deleteCommentHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { commentId } = event.pathParameters || {};

    if (!commentId) {
      return errorResponse(400, 'Comment ID required.');
    }

    const result = await query('DELETE FROM comments WHERE id = $1 RETURNING id;', [commentId]);

    if (result.rows.length === 0) {
      return errorResponse(404, 'Comment not found.');
    }

    return response(200, { message: 'Comment deleted successfully.' });
  } catch (error: any) {
    console.error('Delete comment handler error:', error);
    return errorResponse(500, 'Internal server error.');
  }
};
