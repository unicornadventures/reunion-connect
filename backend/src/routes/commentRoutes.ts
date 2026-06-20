import express from 'express';
import { query } from '../db.ts';

const router = express.Router();

// GET /api/comments/my-comments/:commenterId - Get comments posted by a user
router.get('/my-comments/:commenterId', async (req, res) => {
  const { commenterId } = req.params;

  try {
    const result = await query(`
      SELECT
        c.id, c.target_user_id, c.commenter_id, c.content, c.published, c.created_at, c.updated_at,
        p.first_name, p.last_name
      FROM comments c
      LEFT JOIN profiles p ON c.commenter_id = p.user_id
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
      SELECT
        c.id, c.target_user_id, c.commenter_id, c.content, c.published, c.created_at, c.updated_at,
        p.first_name, p.last_name
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
      VALUES ($1, $2, $3, true)
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
  const { content, published } = req.body;

  if (content === undefined && published === undefined) {
    return res.status(400).json({ error: 'At least one of content or published is required.' });
  }

  try {
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
