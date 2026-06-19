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

// GET /api/classes/:id
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

// GET /api/classes/:id/members
router.get('/:id/members', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(`
      SELECT u.id, u.email, p.first_name, p.last_name, p.nickname_school
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

export { router as classRoutes };