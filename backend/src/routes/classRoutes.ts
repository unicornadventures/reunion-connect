import express from 'express';
import { query } from '../db.ts';

const router = express.Router();

// GET /api/classes — all available class years (for dropdowns)
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT id, year FROM classes ORDER BY year DESC;');
    res.status(200).json({ classes: result.rows });
  } catch (error) {
    console.error("Get Classes Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/classes/:id/members — must come before /:id
router.get('/:id/members', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(`
      SELECT u.id, u.email, p.first_name, p.last_name, p.nickname
      FROM class_user cu
      JOIN users u ON cu.user_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE cu.class_id = $1
      ORDER BY p.last_name, p.first_name;
    `, [id]);

    res.status(200).json({ members: result.rows });
  } catch (error) {
    console.error("Get Class Members Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/classes/:id/directory
router.get('/:id/directory', async (req, res) => {
  const { id } = req.params;
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  try {
    const userClassCheck = await query(
      'SELECT class_id FROM class_user WHERE user_id = $1 AND class_id = $2',
      [userId, id]
    );

    if (userClassCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied. You are not in this class.' });
    }

    const result = await query(`
      SELECT
        u.id,
        u.email,
        u.is_deceased,
        p.first_name,
        p.last_name,
        p.nickname,
        p.former_first_name,
        p.former_last_name,
        p.now_photo_url,
        p.then_photo_url,
        p.avatar_color,
        p.tags
      FROM class_user cu
      JOIN users u ON cu.user_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE cu.class_id = $1
      ORDER BY COALESCE(p.former_last_name, p.last_name), COALESCE(p.former_first_name, p.first_name);
    `, [id]);

    res.status(200).json({ users: result.rows });
  } catch (error) {
    console.error("Get Class Directory Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/classes/:id/photos — flat list of then/now/gallery photos for the class slideshow
router.get('/:id/photos', async (req, res) => {
  const { id } = req.params;
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  try {
    const userClassCheck = await query(
      'SELECT class_id FROM class_user WHERE user_id = $1 AND class_id = $2',
      [userId, id]
    );

    if (userClassCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied. You are not in this class.' });
    }

    const profileResult = await query(`
      SELECT u.id AS user_id, p.then_photo_url, p.now_photo_url
      FROM class_user cu
      JOIN users u ON cu.user_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE cu.class_id = $1
    `, [id]);

    const galleryResult = await query(`
      SELECT gp.user_id, gp.s3_key
      FROM gallery_photos gp
      JOIN class_user cu ON gp.user_id = cu.user_id
      WHERE cu.class_id = $1
    `, [id]);

    const photos: { url: string; userId: number }[] = [];
    for (const row of profileResult.rows) {
      if (row.then_photo_url) photos.push({ url: row.then_photo_url, userId: row.user_id });
      if (row.now_photo_url) photos.push({ url: row.now_photo_url, userId: row.user_id });
    }
    for (const row of galleryResult.rows) {
      photos.push({ url: row.s3_key, userId: row.user_id });
    }

    res.status(200).json({ photos });
  } catch (error) {
    console.error('Get Class Photos Error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/classes/:id/alumni-count
router.get('/:id/alumni-count', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      'SELECT COUNT(*) as count FROM class_user WHERE class_id = $1',
      [id]
    );
    res.status(200).json({ count: parseInt(result.rows[0].count, 10) });
  } catch (error) {
    console.error("Get Alumni Count Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/classes/:id/message-count
router.get('/:id/message-count', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      `SELECT COUNT(*) as count FROM comments c
       WHERE c.published = true
       AND c.target_user_id IN (
         SELECT u.id FROM users u
         JOIN class_user cu ON u.id = cu.user_id
         WHERE cu.class_id = $1
       )`,
      [id]
    );
    res.status(200).json({ count: parseInt(result.rows[0].count, 10) });
  } catch (error) {
    console.error("Get Message Count Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/classes/:id — must come last
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(`
      SELECT c.id, c.year, cs.school_id, s.name AS school_name, c.created_at
      FROM classes c
      LEFT JOIN class_school cs ON c.id = cs.class_id
      LEFT JOIN schools s ON cs.school_id = s.id
      WHERE c.id = $1
      LIMIT 1;
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found.' });
    }
    res.status(200).json({ class: result.rows[0] });
  } catch (error) {
    console.error("Get Class Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export { router as classRoutes };
