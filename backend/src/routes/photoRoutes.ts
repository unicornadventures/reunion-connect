import express from 'express';
import multer from 'multer';
import { query } from '../db.ts';
import { generatePresignedUrl, uploadFileToS3, deletePhotoFromS3 } from '../s3Service.ts';

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

// Can requesterId manage (upload/replace) the then/now photos of targetUserId?
async function canManagePhotos(requesterId: number, targetUserId: number): Promise<boolean> {
  if (requesterId === targetUserId) return true;

  const requesterResult = await query('SELECT is_admin, is_class_admin FROM users WHERE id = $1', [requesterId]);
  if (requesterResult.rows.length === 0) return false;

  const requester = requesterResult.rows[0];
  if (requester.is_admin) return true;

  if (requester.is_class_admin) {
    const sameClass = await query(`
      SELECT 1 FROM class_user cu1
      JOIN class_user cu2 ON cu1.class_id = cu2.class_id
      WHERE cu1.user_id = $1 AND cu2.user_id = $2
      LIMIT 1
    `, [requesterId, targetUserId]);
    return sameClass.rows.length > 0;
  }

  return false;
}

// Can requesterId view the gallery/then-now photos of targetUserId?
async function canViewPhotos(requesterId: number, targetUserId: number): Promise<boolean> {
  if (requesterId === targetUserId) return true;

  const requesterResult = await query('SELECT is_admin FROM users WHERE id = $1', [requesterId]);
  if (requesterResult.rows.length === 0) return false;
  if (requesterResult.rows[0].is_admin) return true;

  const sameClass = await query(`
    SELECT 1 FROM class_user cu1
    JOIN class_user cu2 ON cu1.class_id = cu2.class_id
    WHERE cu1.user_id = $1 AND cu2.user_id = $2
    LIMIT 1
  `, [requesterId, targetUserId]);
  return sameClass.rows.length > 0;
}

// POST /api/users/:userId/photo/:photoType - Upload file directly
router.post('/:userId/photo/:photoType', upload.single('file'), async (req, res) => {
  const { photoType, userId } = req.params;
  const { requesterId } = req.query;

  if (!photoType || !userId || !req.file) {
    return res.status(400).json({ error: 'Missing required parameters or file.' });
  }

  if (photoType !== 'then' && photoType !== 'now') {
    return res.status(400).json({ error: 'photoType must be "then" or "now".' });
  }

  if (!requesterId) {
    return res.status(400).json({ error: 'requesterId query parameter is required.' });
  }

  try {
    const authorized = await canManagePhotos(parseInt(String(requesterId), 10), parseInt(userId, 10));
    if (!authorized) {
      return res.status(403).json({ error: 'You do not have permission to manage this photo.' });
    }

    // Verify user exists
    const userCheck = await query('SELECT id FROM users WHERE id = $1;', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Upload file to S3
    const photoUrl = await uploadFileToS3(parseInt(userId), req.file.originalname, req.file.buffer);

    // Update profile with photo URL
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
    console.error("Photo Upload Error:", error);
    res.status(500).json({ error: 'Could not upload photo.' });
  }
});

// POST /api/users/:userId/photo/upload/:photoType
router.post('/:userId/photo/upload/:photoType', async (req, res) => {
  const { photoType, userId } = req.params;
  const { fileName, requesterId } = req.body;

  if (!photoType || !fileName || !userId) {
    return res.status(400).json({ error: 'Missing required parameters.' });
  }

  if (photoType !== 'then' && photoType !== 'now') {
    return res.status(400).json({ error: 'photoType must be "then" or "now".' });
  }

  if (!requesterId) {
    return res.status(400).json({ error: 'requesterId is required.' });
  }

  try {
    const authorized = await canManagePhotos(parseInt(String(requesterId), 10), parseInt(userId, 10));
    if (!authorized) {
      return res.status(403).json({ error: 'You do not have permission to manage this photo.' });
    }

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
  const { photoUrl, requesterId } = req.body;

  if (!photoType || !photoUrl || !userId) {
    return res.status(400).json({ error: 'Missing required parameters.' });
  }

  if (!requesterId) {
    return res.status(400).json({ error: 'requesterId is required.' });
  }

  if (photoType !== 'then' && photoType !== 'now') {
    return res.status(400).json({ error: 'photoType must be "then" or "now".' });
  }

  try {
    const authorized = await canManagePhotos(parseInt(String(requesterId), 10), parseInt(userId, 10));
    if (!authorized) {
      return res.status(403).json({ error: 'You do not have permission to manage this photo.' });
    }

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

// DELETE /api/users/:userId/photo/:photoType
router.delete('/:userId/photo/:photoType', async (req, res) => {
  const { photoType, userId } = req.params;
  const { requesterId } = req.query;

  if (!photoType || !userId) {
    return res.status(400).json({ error: 'Missing required parameters.' });
  }

  if (photoType !== 'then' && photoType !== 'now') {
    return res.status(400).json({ error: 'photoType must be "then" or "now".' });
  }

  if (!requesterId) {
    return res.status(400).json({ error: 'requesterId query parameter is required.' });
  }

  try {
    const authorized = await canManagePhotos(parseInt(String(requesterId), 10), parseInt(userId, 10));
    if (!authorized) {
      return res.status(403).json({ error: 'You do not have permission to manage this photo.' });
    }

    const column = photoType === 'then' ? 'then_photo_url' : 'now_photo_url';
    const profileResult = await query(`SELECT ${column} FROM profiles WHERE user_id = $1`, [userId]);

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    const photoUrl = profileResult.rows[0][column];
    if (photoUrl) {
      await deletePhotoFromS3(photoUrl);
    }

    const result = await query(
      `UPDATE profiles SET ${column} = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 RETURNING *;`,
      [userId]
    );

    res.status(200).json({ profile: result.rows[0] });
  } catch (error) {
    console.error("Delete Photo Error:", error);
    res.status(500).json({ error: 'Could not delete photo.' });
  }
});

// GET /api/users/:userId/gallery
router.get('/:userId/gallery', async (req, res) => {
  const { userId } = req.params;
  const { requesterId } = req.query;

  if (!requesterId) {
    return res.status(400).json({ error: 'requesterId query parameter is required.' });
  }

  try {
    const authorized = await canViewPhotos(parseInt(String(requesterId), 10), parseInt(userId, 10));
    if (!authorized) {
      return res.status(403).json({ error: 'You do not have permission to view this gallery.' });
    }

    const result = await query(
      'SELECT id, s3_key, created_at FROM gallery_photos WHERE user_id = $1 ORDER BY created_at ASC',
      [userId]
    );
    res.status(200).json({ photos: result.rows.map(r => ({ id: r.id, url: r.s3_key, created_at: r.created_at })) });
  } catch (error) {
    console.error('List gallery photos error:', error);
    res.status(500).json({ error: 'Could not fetch gallery photos.' });
  }
});

// POST /api/users/:userId/gallery - returns presigned URL (dev: returns placeholder URL)
router.post('/:userId/gallery', async (req, res) => {
  const { userId } = req.params;
  const { requesterId } = req.body;

  if (!requesterId) {
    return res.status(400).json({ error: 'requesterId is required.' });
  }

  try {
    const authorized = await canManagePhotos(parseInt(String(requesterId), 10), parseInt(userId, 10));
    if (!authorized) {
      return res.status(403).json({ error: 'You do not have permission to manage this gallery.' });
    }

    const countResult = await query('SELECT COUNT(*) FROM gallery_photos WHERE user_id = $1', [userId]);
    if (parseInt(countResult.rows[0].count, 10) >= 9) {
      return res.status(400).json({ error: 'Gallery limit of 9 photos reached.' });
    }
    const suffix = Date.now().toString(36);
    const key = `photos/other/${userId}-gallery-${suffix}.jpg`;
    const insertResult = await query(
      'INSERT INTO gallery_photos (user_id, s3_key) VALUES ($1, $2) RETURNING id',
      [userId, key]
    );
    const presignedUrl = await generatePresignedUrl(parseInt(userId), `gallery-${suffix}.jpg`);
    res.status(200).json({ presignedUrl, key, id: insertResult.rows[0].id });
  } catch (error) {
    console.error('Upload gallery photo error:', error);
    res.status(500).json({ error: 'Could not initiate gallery upload.' });
  }
});

// DELETE /api/users/:userId/gallery/:photoId
router.delete('/:userId/gallery/:photoId', async (req, res) => {
  const { userId, photoId } = req.params;
  const { requesterId } = req.query;

  if (!requesterId) {
    return res.status(400).json({ error: 'requesterId query parameter is required.' });
  }

  try {
    const authorized = await canManagePhotos(parseInt(String(requesterId), 10), parseInt(userId, 10));
    if (!authorized) {
      return res.status(403).json({ error: 'You do not have permission to manage this gallery.' });
    }

    const result = await query(
      'DELETE FROM gallery_photos WHERE id = $1 AND user_id = $2 RETURNING id',
      [photoId, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Photo not found.' });
    res.status(200).json({ message: 'Gallery photo deleted.' });
  } catch (error) {
    console.error('Delete gallery photo error:', error);
    res.status(500).json({ error: 'Could not delete gallery photo.' });
  }
});

export { router as photoRoutes };