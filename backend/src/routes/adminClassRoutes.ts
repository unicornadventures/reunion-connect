import express from 'express';
import { query } from '../db.ts';
import { requireSuperAdmin } from '../middleware/adminAuth.ts';

const router = express.Router();

// GET /api/admin/classes — all classes with school context
router.get('/', requireSuperAdmin, async (req: any, res) => {
  try {
    const result = await query(`
      SELECT c.id, c.year, cs.school_id, s.name AS school_name, c.created_at
      FROM classes c
      JOIN class_school cs ON c.id = cs.class_id
      JOIN schools s ON cs.school_id = s.id
      ORDER BY c.year DESC, s.name ASC;
    `);
    res.status(200).json({ classes: result.rows });
  } catch (error) {
    console.error("Admin Get Classes Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/admin/classes/:id/users — must come before /:id
router.get('/:id/users', requireSuperAdmin, async (req: any, res) => {
  const { id } = req.params;

  try {
    const result = await query(`
      SELECT u.id, u.email, p.first_name, p.last_name
      FROM class_user cu
      JOIN users u ON cu.user_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE cu.class_id = $1
      ORDER BY p.last_name ASC, p.first_name ASC;
    `, [id]);

    res.status(200).json({ users: result.rows });
  } catch (error) {
    console.error("Admin Get Class Users Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/admin/classes/:id — single class
router.get('/:id', requireSuperAdmin, async (req: any, res) => {
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
    console.error("Admin Get Class Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export { router as adminClassRoutes };
