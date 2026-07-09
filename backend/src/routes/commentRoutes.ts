import express from 'express';
import { query } from '../db.ts';

const router = express.Router();

// Helper function to check if user is authorized to moderate comments
// userId: the user trying to moderate
// commenterId: the user who created the comment
// targetUserId: the user whose profile the comment is on
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
    const sameClassResult = await query(`
      SELECT cu1.class_id
      FROM class_user cu1
      WHERE cu1.user_id = $1
      AND cu1.class_id IN (
        SELECT cu2.class_id FROM class_user cu2 WHERE cu2.user_id = $2
      )
    `, [userId, commenterId]);

    return sameClassResult.rows.length > 0;
  }

  return false;
}

// GET /api/comments/my-comments/:commenterId - Get comments posted by a user
router.get('/my-comments/:commenterId', async (req, res) => {
  const { commenterId } = req.params;

  try {
    const result = await query(`
      SELECT
        c.id, c.target_user_id, c.commenter_id, c.content, c.published, c.created_at, c.updated_at
      FROM comments c
      WHERE c.commenter_id = $1
      ORDER BY c.created_at DESC;
    `, [commenterId]);

    res.status(200).json({ comments: result.rows });
  } catch (error) {
    console.error('Get My Comments Error:', error);
    res.status(500).json({ error: 'Could not fetch comments.' });
  }
});

// GET /api/users/:targetUserId/comments
router.get('/:targetUserId/comments', async (req, res) => {
  const { targetUserId } = req.params;

  try {
    const result = await query(`
      SELECT c.id, c.target_user_id, c.commenter_id, c.content, c.published, c.created_at, c.updated_at,
             p.first_name AS commenter_first_name, p.last_name AS commenter_last_name
      FROM comments c
      LEFT JOIN profiles p ON c.commenter_id = p.user_id
      WHERE c.target_user_id = $1 AND c.published = true
      ORDER BY c.created_at DESC;
    `, [targetUserId]);

    res.status(200).json({ comments: result.rows });
  } catch (error) {
    console.error('Get Comments Error:', error);
    res.status(500).json({ error: 'Could not fetch comments.' });
  }
});

// GET /api/users/:targetUserId/comments/pending - Get pending comments for moderation
router.get('/:targetUserId/comments/pending', async (req, res) => {
  const { targetUserId } = req.params;
  const { requesterId } = req.query;

  if (!requesterId) {
    return res.status(400).json({ error: 'requesterId query parameter is required.' });
  }

  try {
    const requesterIdNum = parseInt(String(requesterId));
    const targetUserIdNum = parseInt(targetUserId);

    // Get all comments for this profile
    const result = await query(`
      SELECT c.id, c.target_user_id, c.commenter_id, c.content, c.published, c.created_at, c.updated_at,
             p.first_name AS commenter_first_name, p.last_name AS commenter_last_name
      FROM comments c
      LEFT JOIN profiles p ON c.commenter_id = p.user_id
      WHERE c.target_user_id = $1
      ORDER BY c.published ASC, c.created_at DESC;
    `, [targetUserIdNum]);

    // Filter comments based on authorization for each one
    const authorizedComments = [];
    for (const comment of result.rows) {
      const isAuthorized = await canModerateComments(requesterIdNum, comment.commenter_id, targetUserIdNum);
      if (isAuthorized) {
        authorizedComments.push(comment);
      }
    }

    res.status(200).json({ comments: authorizedComments });
  } catch (error) {
    console.error('Get Pending Comments Error:', error);
    res.status(500).json({ error: 'Could not fetch comments.' });
  }
});

// POST /api/users/:targetUserId/comments
router.post('/:targetUserId/comments', async (req, res) => {
  const { targetUserId } = req.params;
  const { commenterId, content } = req.body;

  if (!commenterId || !content) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const result = await query(`
      INSERT INTO comments (target_user_id, commenter_id, content, published)
      VALUES ($1, $2, $3, false)
      RETURNING id, target_user_id, commenter_id, content, published, created_at, updated_at;
    `, [targetUserId, commenterId, content]);

    res.status(201).json({ comment: result.rows[0] });
  } catch (error) {
    console.error('Create Comment Error:', error);
    res.status(500).json({ error: 'Could not create comment.' });
  }
});

// PUT /api/comments/:commentId
router.put('/:commentId', async (req, res) => {
  const { commentId } = req.params;
  const { content, published, requesterId } = req.body;

  if (content === undefined && published === undefined) {
    return res.status(400).json({ error: 'At least one of content or published is required.' });
  }

  try {
    // Get the comment to find its target user
    const commentResult = await query(
      'SELECT id, target_user_id, commenter_id FROM comments WHERE id = $1',
      [commentId]
    );

    if (commentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    const comment = commentResult.rows[0];

    // If trying to publish/unpublish, check authorization
    if (published !== undefined && requesterId) {
      const requesterIdNum = parseInt(String(requesterId));
      const isAuthorized = await canModerateComments(requesterIdNum, comment.commenter_id, comment.target_user_id);
      if (!isAuthorized) {
        return res.status(403).json({ error: 'Not authorized to moderate this comment.' });
      }
    }

    // If editing content, only commenter can do it
    if (content !== undefined && requesterId) {
      const requesterIdNum = parseInt(String(requesterId));
      if (requesterIdNum !== comment.commenter_id) {
        return res.status(403).json({ error: 'You can only edit your own comments.' });
      }
    }

    let updateFields = [];
    let params: any[] = [];
    let paramCount = 1;

    if (content !== undefined) {
      updateFields.push(`content = $${paramCount++}`);
      params.push(content);
      // Edited comments go back to pending moderation
      updateFields.push(`published = false`);
    }

    if (published !== undefined) {
      updateFields.push(`published = $${paramCount++}`);
      params.push(published);
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(commentId);

    const result = await query(`
      UPDATE comments
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, target_user_id, commenter_id, content, published, created_at, updated_at;
    `, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    res.status(200).json({ comment: result.rows[0] });
  } catch (error) {
    console.error('Update Comment Error:', error);
    res.status(500).json({ error: 'Could not update comment.' });
  }
});

// DELETE /api/comments/:commentId
router.delete('/:commentId', async (req, res) => {
  const { commentId } = req.params;

  try {
    const result = await query('DELETE FROM comments WHERE id = $1 RETURNING id;', [commentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    res.status(200).json({ message: 'Comment deleted successfully.' });
  } catch (error) {
    console.error('Delete Comment Error:', error);
    res.status(500).json({ error: 'Could not delete comment.' });
  }
});

export { router as commentRoutes };
