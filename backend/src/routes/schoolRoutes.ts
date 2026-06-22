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

// GET /api/schools/:id/classes
router.get('/:id/classes', async (req, res) => {
  const { id } = req.params;

  try {
    const schoolCheck = await query('SELECT id FROM schools WHERE id = $1;', [id]);
    if (schoolCheck.rows.length === 0) {
      return res.status(404).json({ error: 'School not found.' });
    }

    const currentYear = new Date().getFullYear();

    const currentYearLinked = await query(
      `SELECT 1 FROM class_school cs
       JOIN classes c ON cs.class_id = c.id
       WHERE cs.school_id = $1 AND c.year = $2`,
      [id, currentYear]
    );

    if (currentYearLinked.rows.length === 0) {
      const hasAny = await query('SELECT 1 FROM class_school WHERE school_id = $1 LIMIT 1', [id]);
      if (hasAny.rows.length > 0) {
        const classRow = await query('SELECT id FROM classes WHERE year = $1', [currentYear]);
        if (classRow.rows.length > 0) {
          await query(
            'INSERT INTO class_school (class_id, school_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [classRow.rows[0].id, id]
          );
        }
      }
    }

    const result = await query(
      `SELECT c.id, c.year, COUNT(cu.user_id)::int AS member_count
       FROM classes c
       JOIN class_school cs ON c.id = cs.class_id
       LEFT JOIN class_user cu ON c.id = cu.class_id AND cu.school_id = cs.school_id
       WHERE cs.school_id = $1
       GROUP BY c.id, c.year
       ORDER BY c.year DESC;`,
      [id]
    );
    res.status(200).json({ classes: result.rows });
  } catch (error) {
    console.error("Get School Classes Error:", error);
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

// GET /api/schools/:schoolId/classes/:classId/events
router.get('/:schoolId/classes/:classId/events', async (req, res) => {
  const { schoolId, classId } = req.params;
  try {
    const result = await query(
      `SELECT id, class_id, school_id, event_name as title, description, event_date, event_time, location, created_at, updated_at
       FROM events
       WHERE class_id = $1 AND school_id = $2
       ORDER BY event_date ASC, event_time ASC NULLS LAST;`,
      [classId, schoolId]
    );
    res.status(200).json({ events: result.rows });
  } catch (error) {
    console.error('Get School Class Events Error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export { router as schoolRoutes };
