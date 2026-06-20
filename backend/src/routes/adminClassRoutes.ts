import express from 'express';
import { query } from '../db.ts';
import { requireSuperAdmin } from '../middleware/adminAuth.ts';
import { deleteUserPhotosFromS3 } from '../s3Service.ts';

const router = express.Router();

// GET /api/admin/classes - Read all classes
router.get('/', requireSuperAdmin, async (req: any, res) => {
  try {
    const result = await query(`
      SELECT c.id, c.year, c.school_id, s.name as school_name, c.created_at, c.updated_at
      FROM classes c
      JOIN schools s ON c.school_id = s.id
      ORDER BY c.year DESC, s.name ASC;
    `);
    res.status(200).json({ classes: result.rows });
  } catch (error) {
    console.error("Admin Get Classes Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/admin/classes/:id - Read single class
router.get('/:id', requireSuperAdmin, async (req: any, res) => {
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
    console.error("Admin Get Class Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/admin/classes - Create class
router.post('/', requireSuperAdmin, async (req: any, res) => {
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
    console.error("Admin Create Class Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/admin/classes/:id - Update class
router.put('/:id', requireSuperAdmin, async (req: any, res) => {
  const { id } = req.params;
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
      'UPDATE classes SET school_id = $1, year = $2, updated_at = NOW() WHERE id = $3 RETURNING *;',
      [school_id, year, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found.' });
    }

    res.status(200).json({ class: result.rows[0] });
  } catch (error) {
    console.error("Admin Update Class Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/admin/classes/:id - Delete class
router.delete('/:id', requireSuperAdmin, async (req: any, res) => {
  const { id } = req.params;
  const cascadeUsers = req.query.cascadeUsers === 'true';

  try {
    await query('BEGIN;');

    // If cascadeUsers is true, delete all users in this class
    if (cascadeUsers) {
      // First, get all user IDs so we can clean up their S3 photos
      const usersResult = await query(`
        SELECT DISTINCT user_id as id
        FROM class_user
        WHERE class_id = $1
      `, [id]);

      // Clean up S3 photos for each user
      for (const user of usersResult.rows) {
        await deleteUserPhotosFromS3(user.id);
      }

      // Now delete the users
      await query(`
        DELETE FROM users
        WHERE id IN (
          SELECT user_id
          FROM class_user
          WHERE class_id = $1
        );
      `, [id]);
    }

    // Delete the class (which cascades to class_user via foreign key)
    const result = await query('DELETE FROM classes WHERE id = $1 RETURNING *;', [id]);

    if (result.rows.length === 0) {
      await query('ROLLBACK;');
      return res.status(404).json({ error: 'Class not found.' });
    }

    await query('COMMIT;');
    res.status(200).json({ message: 'Class deleted successfully.' });
  } catch (error) {
    await query('ROLLBACK;');
    console.error("Admin Delete Class Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export { router as adminClassRoutes };
