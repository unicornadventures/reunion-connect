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

// GET /api/classes/:id/events — must come before /:id
router.get('/:id/events', async (req, res) => {
  const { id } = req.params;
  const { schoolId } = req.query as { schoolId?: string };

  try {
    const params: any[] = [id];
    let schoolFilter = '';
    if (schoolId) {
      params.push(schoolId);
      schoolFilter = ` AND school_id = $${params.length}`;
    }

    const result = await query(
      `SELECT id, class_id, school_id, event_name as title, description, event_date, event_time, location, created_at, updated_at
       FROM events
       WHERE class_id = $1${schoolFilter}
       ORDER BY event_date ASC, event_time ASC NULLS LAST;`,
      params
    );

    res.status(200).json({ events: result.rows });
  } catch (error) {
    console.error('Get Class Events Error:', error);
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
    res.status(200).json({ count: parseInt(result.rows[0].count, 10) });
  } catch (error) {
    console.error("Get Alumni Count Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/classes/:id/recently-joined
router.get('/:id/recently-joined', async (req, res) => {
  const { id } = req.params;

  try {
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
