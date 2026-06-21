import express from 'express';
import { query } from '../db.ts';

const router = express.Router();

// GET /api/classes
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT c.id, c.year, c.school_id, s.name as school_name, c.created_at, c.updated_at
      FROM classes c
      JOIN schools s ON c.school_id = s.id
      ORDER BY c.year DESC, s.name ASC;
    `);
    res.status(200).json({ classes: result.rows });
  } catch (error) {
    console.error("Get Classes Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/classes
router.post('/', async (req, res) => {
  const { school_id, year } = req.body;

  if (!school_id || !year) {
    return res.status(400).json({ error: 'school_id and year are required.' });
  }

  try {
    // Verify school exists
    const schoolCheck = await query('SELECT id FROM schools WHERE id = $1;', [school_id]);
    if (schoolCheck.rows.length === 0) {
      return res.status(400).json({ error: 'School not found.' });
    }

    const result = await query(
      'INSERT INTO classes (school_id, year) VALUES ($1, $2) RETURNING *;',
      [school_id, year]
    );
    res.status(201).json({ class: result.rows[0] });
  } catch (error) {
    console.error("Create Class Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/classes/:id/members - Must come before /:id
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

// GET /api/classes/:id/directory - Get users by class with full profile (for directory)
router.get('/:id/directory', async (req, res) => {
  const { id } = req.params;
  const userId = req.query.userId; // Requires userId for validation

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  try {
    // Validate that the requesting user is in this class
    const userClassCheck = await query(
      'SELECT class_id FROM class_user WHERE user_id = $1 AND class_id = $2',
      [userId, id]
    );

    if (userClassCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied. You are not in this class.' });
    }

    // Fetch directory only if user is authorized
    const result = await query(`
      SELECT
        u.id,
        u.email,
        p.first_name,
        p.last_name,
        p.nickname,
        p.now_photo_url,
        p.then_photo_url
      FROM class_user cu
      JOIN users u ON cu.user_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE cu.class_id = $1
      ORDER BY p.last_name, p.first_name;
    `, [id]);

    res.status(200).json({ users: result.rows });
  } catch (error) {
    console.error("Get Class Directory Error:", error);
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

    const count = parseInt(result.rows[0].count, 10);
    res.status(200).json({ count });
  } catch (error) {
    console.error("Get Alumni Count Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/classes/:id/recently-joined
router.get('/:id/recently-joined', async (req, res) => {
  const { id } = req.params;

  try {
    // Get the last 3 users who joined this class, ordered by registration date (newest first)
    const result = await query(`
      SELECT
        u.id,
        u.email,
        u.created_at,
        p.first_name,
        p.last_name,
        p.nickname,
        p.now_photo_url,
        p.then_photo_url
      FROM class_user cu
      JOIN users u ON cu.user_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE cu.class_id = $1
      ORDER BY u.created_at DESC
      LIMIT 3;
    `, [id]);

    res.status(200).json({ users: result.rows });
  } catch (error) {
    console.error("Get Recently Joined Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/classes/:id/message-count
router.get('/:id/message-count', async (req, res) => {
  const { id } = req.params;

  try {
    // Count published comments where the target_user_id belongs to this class
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

    const count = parseInt(result.rows[0].count, 10);
    res.status(200).json({ count });
  } catch (error) {
    console.error("Get Message Count Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/classes/:id - Generic class fetch (must come last)
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(`
      SELECT c.id, c.year, c.school_id, s.name as school_name, c.created_at, c.updated_at
      FROM classes c
      JOIN schools s ON c.school_id = s.id
      WHERE c.id = $1;
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