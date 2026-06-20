import express from 'express';
import { query } from '../db.ts';
import { requireSuperAdmin } from '../middleware/adminAuth.ts';

const router = express.Router();

// GET /api/admin/schools - Read all schools
router.get('/', requireSuperAdmin, async (req: any, res) => {
  try {
    const result = await query('SELECT * FROM schools ORDER BY name ASC;');
    res.status(200).json({ schools: result.rows });
  } catch (error) {
    console.error("Admin Get Schools Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/admin/schools/:id - Read single school
router.get('/:id', requireSuperAdmin, async (req: any, res) => {
  const { id } = req.params;

  try {
    const result = await query('SELECT * FROM schools WHERE id = $1;', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'School not found.' });
    }
    res.status(200).json({ school: result.rows[0] });
  } catch (error) {
    console.error("Admin Get School Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/admin/schools - Create school
router.post('/', requireSuperAdmin, async (req: any, res) => {
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
    console.error("Admin Create School Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/admin/schools/:id - Update school
router.put('/:id', requireSuperAdmin, async (req: any, res) => {
  const { id } = req.params;
  const { name, location } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'School name is required.' });
  }

  try {
    const result = await query(
      'UPDATE schools SET name = $1, location = $2, updated_at = NOW() WHERE id = $3 RETURNING *;',
      [name, location || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'School not found.' });
    }

    res.status(200).json({ school: result.rows[0] });
  } catch (error) {
    console.error("Admin Update School Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/admin/schools/:id - Delete school
router.delete('/:id', requireSuperAdmin, async (req: any, res) => {
  const { id } = req.params;
  const cascadeUsers = req.query.cascadeUsers === 'true';

  try {
    await query('BEGIN;');

    // If cascadeUsers is true, delete all users in classes for this school
    if (cascadeUsers) {
      await query(`
        DELETE FROM users
        WHERE id IN (
          SELECT DISTINCT u.id
          FROM users u
          JOIN class_user cu ON u.id = cu.user_id
          JOIN classes c ON cu.class_id = c.id
          WHERE c.school_id = $1
        );
      `, [id]);
    }

    // Delete the school (which cascades to classes and class_user via foreign keys)
    const result = await query('DELETE FROM schools WHERE id = $1 RETURNING *;', [id]);

    if (result.rows.length === 0) {
      await query('ROLLBACK;');
      return res.status(404).json({ error: 'School not found.' });
    }

    await query('COMMIT;');
    res.status(200).json({ message: 'School deleted successfully.' });
  } catch (error) {
    await query('ROLLBACK;');
    console.error("Admin Delete School Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export { router as adminSchoolRoutes };
