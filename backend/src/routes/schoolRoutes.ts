import express from 'express';
import { query } from '../db.ts';

const router = express.Router();

// GET /api/schools
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM schools ORDER BY name ASC;');
    res.status(200).json({ schools: result.rows });
  } catch (error) {
    console.error("Get Schools Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/schools/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query('SELECT * FROM schools WHERE id = $1;', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'School not found.' });
    }
    res.status(200).json({ school: result.rows[0] });
  } catch (error) {
    console.error("Get School Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/schools
router.post('/', async (req, res) => {
  const { name, location } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'School name is required.' });
  }

  try {
    const result = await query(
      'INSERT INTO schools (name, location) VALUES ($1, $2) RETURNING *;',
      [name, location || null]
    );
    res.status(201).json({ school: result.rows[0] });
  } catch (error) {
    console.error("Create School Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export { router as schoolRoutes };