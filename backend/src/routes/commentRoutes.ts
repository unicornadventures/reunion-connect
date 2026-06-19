import express from 'express';
import { query } from '../db.ts';

const router = express.Router();

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
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Content is required.' });
  }

  try {
    const result = await query(`
      UPDATE comments
      SET content = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, target_user_id, commenter_id, content, published, created_at, updated_at;
    `, [content, commentId]);

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
