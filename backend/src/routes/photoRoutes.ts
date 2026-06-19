import express from 'express';
import { query } from '../db.ts';
import { generatePresignedUrl } from '../s3Service.ts';

const router = express.Router();

// POST /api/users/:userId/photo/upload/:photoType
router.post('/:userId/photo/upload/:photoType', async (req, res) => {
  const { photoType, userId } = req.params;
  const { fileName } = req.body;

  if (!photoType || !fileName || !userId) {
    return res.status(400).json({ error: 'Missing required parameters.' });
  }

  if (photoType !== 'then' && photoType !== 'now') {
    return res.status(400).json({ error: 'photoType must be "then" or "now".' });
  }

  try {
    // Verify user exists
    const userCheck = await query('SELECT id FROM users WHERE id = $1;', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const presignedUrl = await generatePresignedUrl(parseInt(userId), fileName);
    res.status(200).json({ presignedUrl });
  } catch (error) {
    console.error("Generate URL Error:", error);
    res.status(500).json({ error: 'Could not generate secure upload URL.' });
  }
});

// PUT /api/users/:userId/photo/:photoType
router.put('/:userId/photo/:photoType', async (req, res) => {
  const { photoType, userId } = req.params;
  const { photoUrl } = req.body;

  if (!photoType || !photoUrl || !userId) {
    return res.status(400).json({ error: 'Missing required parameters.' });
  }

  if (photoType !== 'then' && photoType !== 'now') {
    return res.status(400).json({ error: 'photoType must be "then" or "now".' });
  }

  try {
    const column = photoType === 'then' ? 'then_photo_url' : 'now_photo_url';

    const result = await query(
      `UPDATE profiles SET ${column} = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 RETURNING *;`,
      [photoUrl, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    res.status(200).json({ profile: result.rows[0] });
  } catch (error) {
    console.error("Update Photo Error:", error);
    res.status(500).json({ error: 'Could not update photo URL.' });
  }
});

export { router as photoRoutes };