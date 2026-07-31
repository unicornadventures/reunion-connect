import express from 'express';
import { query } from '../db.ts';
import { authenticateToken } from '../utils/auth.ts';

const router = express.Router();

// The whole feedback module can be switched off by setting FEEDBACK_ENABLED=false.
// Checked per-request so the flag can change without a restart in tests.
router.use((_req, res, next) => {
  if (process.env.FEEDBACK_ENABLED === 'false') {
    return res.status(404).json({ error: 'Feedback is not enabled.' });
  }
  next();
});

router.use(authenticateToken);

// GET /api/feedback - the authenticated user's own feedback only
router.get('/', async (req: any, res) => {
  try {
    const result = await query(`
      SELECT id, user_id, comment, created_at
      FROM feedback
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `, [req.user.id]);

    res.status(200).json({ feedback: result.rows });
  } catch (error) {
    console.error('Get Feedback Error:', error);
    res.status(500).json({ error: 'Could not fetch feedback.' });
  }
});

// POST /api/feedback
router.post('/', async (req: any, res) => {
  const { comment } = req.body;

  if (!comment || !String(comment).trim()) {
    return res.status(400).json({ error: 'Comment is required.' });
  }

  try {
    const result = await query(`
      INSERT INTO feedback (user_id, comment)
      VALUES ($1, $2)
      RETURNING id, user_id, comment, created_at;
    `, [req.user.id, String(comment).trim()]);

    res.status(201).json({ feedback: result.rows[0] });
  } catch (error) {
    console.error('Create Feedback Error:', error);
    res.status(500).json({ error: 'Could not create feedback.' });
  }
});

export { router as feedbackRoutes };
