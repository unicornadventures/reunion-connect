import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../db.ts';
import { requireSuperAdmin } from '../middleware/adminAuth.ts';
import { deleteUserPhotosFromS3 } from '../s3Service.ts';

const router = express.Router();

// GET /api/admin/schools
router.get('/', requireSuperAdmin, async (req: any, res) => {
  try {
    const result = await query('SELECT * FROM schools ORDER BY name ASC;');
    res.status(200).json({ schools: result.rows });
  } catch (error) {
    console.error("Admin Get Schools Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/admin/schools/:id/classes — link a class year to this school
router.post('/:id/classes', requireSuperAdmin, async (req: any, res) => {
  const { id } = req.params;
  const { year } = req.body;

  if (!year) {
    return res.status(400).json({ error: 'year is required.' });
  }

  try {
    const schoolCheck = await query('SELECT id FROM schools WHERE id = $1;', [id]);
    if (schoolCheck.rows.length === 0) {
      return res.status(404).json({ error: 'School not found.' });
    }

    const classRow = await query('SELECT id, year FROM classes WHERE year = $1;', [year]);
    if (classRow.rows.length === 0) {
      return res.status(404).json({ error: `Class year ${year} not found.` });
    }

    const classId = classRow.rows[0].id;

    const existing = await query(
      'SELECT 1 FROM class_school WHERE class_id = $1 AND school_id = $2;',
      [classId, id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: `Class year ${year} is already linked to this school.` });
    }

    await query('INSERT INTO class_school (class_id, school_id) VALUES ($1, $2);', [classId, id]);

    res.status(201).json({ class: classRow.rows[0] });
  } catch (error) {
    console.error("Admin Link Class Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/admin/schools/:id/classes/bulk — link all years from startYear to current year
router.post('/:id/classes/bulk', requireSuperAdmin, async (req: any, res) => {
  const { id } = req.params;
  const { startYear } = req.body;
  const currentYear = new Date().getFullYear();

  if (!startYear || startYear < 1950 || startYear > currentYear) {
    return res.status(400).json({ error: `startYear must be between 1950 and ${currentYear}.` });
  }

  try {
    const schoolCheck = await query('SELECT id FROM schools WHERE id = $1;', [id]);
    if (schoolCheck.rows.length === 0) {
      return res.status(404).json({ error: 'School not found.' });
    }

    const classRows = await query(
      'SELECT id, year FROM classes WHERE year >= $1 AND year <= $2 ORDER BY year DESC;',
      [startYear, currentYear]
    );

    for (const row of classRows.rows) {
      await query(
        'INSERT INTO class_school (class_id, school_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;',
        [row.id, id]
      );
    }

    const linked = await query(
      `SELECT c.id, c.year, COUNT(cu.user_id)::int AS member_count
       FROM classes c
       JOIN class_school cs ON c.id = cs.class_id
       LEFT JOIN class_user cu ON c.id = cu.class_id AND cu.school_id = cs.school_id
       WHERE cs.school_id = $1
       GROUP BY c.id, c.year
       ORDER BY c.year DESC;`,
      [id]
    );

    res.status(201).json({ classes: linked.rows });
  } catch (error) {
    console.error("Admin Bulk Link Classes Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/admin/schools/:id/classes/:classId — unlink a class from this school
router.delete('/:id/classes/:classId', requireSuperAdmin, async (req: any, res) => {
  const { id, classId } = req.params;
  const cascadeUsers = req.query.cascadeUsers === 'true';

  try {
    await query('BEGIN;');

    const linkCheck = await query(
      'SELECT 1 FROM class_school WHERE class_id = $1 AND school_id = $2;',
      [classId, id]
    );
    if (linkCheck.rows.length === 0) {
      await query('ROLLBACK;');
      return res.status(404).json({ error: 'Class is not linked to this school.' });
    }

    if (cascadeUsers) {
      const usersResult = await query(`
        SELECT DISTINCT user_id AS id
        FROM class_user
        WHERE class_id = $1 AND school_id = $2
      `, [classId, id]);

      for (const user of usersResult.rows) {
        await deleteUserPhotosFromS3(user.id);
      }

      await query(`
        DELETE FROM users
        WHERE id IN (
          SELECT user_id FROM class_user
          WHERE class_id = $1 AND school_id = $2
        );
      `, [classId, id]);
    } else {
      await query(
        'DELETE FROM class_user WHERE class_id = $1 AND school_id = $2;',
        [classId, id]
      );
    }

    await query('DELETE FROM class_school WHERE class_id = $1 AND school_id = $2;', [classId, id]);

    await query('COMMIT;');
    res.status(200).json({ message: 'Class unlinked from school successfully.' });
  } catch (error) {
    await query('ROLLBACK;');
    console.error("Admin Unlink Class Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/admin/schools/:id/classes/:classId/users — create a single user in a class
router.post('/:id/classes/:classId/users', requireSuperAdmin, async (req: any, res) => {
  const { id: schoolId, classId } = req.params;
  const { email, original_first_name, original_last_name, first_name, last_name, is_deceased } = req.body;

  if (!first_name?.trim() || !last_name?.trim()) {
    return res.status(400).json({ error: 'first_name and last_name are required.' });
  }

  const resolvedEmail = email?.trim().toLowerCase() || null;

  try {
    if (resolvedEmail) {
      const existing = await query('SELECT id FROM users WHERE email = $1', [resolvedEmail]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'A user with this email already exists.' });
      }
    }

    const tempPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);

    const userResult = await query(
      'INSERT INTO users (email, password, is_deceased) VALUES ($1, $2, $3) RETURNING id, email, is_deceased',
      [resolvedEmail, tempPassword, is_deceased ?? false]
    );
    const user = userResult.rows[0];

    await query(
      `INSERT INTO profiles (user_id, first_name, last_name, former_first_name, former_last_name)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, first_name.trim(), last_name.trim(), original_first_name?.trim() || null, original_last_name?.trim() || null]
    );

    await query(
      'INSERT INTO class_user (class_id, user_id, school_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [classId, user.id, schoolId]
    );

    res.status(201).json({ user: { id: user.id, email: user.email, first_name, last_name, is_deceased: user.is_deceased } });
  } catch (error) {
    console.error('Admin Create User Error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/admin/schools/:id/classes/:classId/users/import — bulk CSV import
router.post('/:id/classes/:classId/users/import', requireSuperAdmin, async (req: any, res) => {
  const { id: schoolId, classId } = req.params;
  const { users } = req.body;

  if (!Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ error: 'users array is required.' });
  }
  if (users.length > 500) {
    return res.status(400).json({ error: 'Maximum 500 users per import.' });
  }

  const created: { first_name: string; last_name: string }[] = [];
  const skipped: { index: number; name: string; reason: string }[] = [];

  for (let i = 0; i < users.length; i++) {
    const { email, original_first_name, original_last_name, first_name, last_name, is_deceased } = users[i];

    if (!first_name?.trim() || !last_name?.trim()) {
      skipped.push({ index: i, name: `Row ${i + 1}`, reason: 'Missing first or last name' });
      continue;
    }

    const resolvedEmail = email?.trim().toLowerCase() || null;

    try {
      if (resolvedEmail) {
        const existing = await query('SELECT id FROM users WHERE email = $1', [resolvedEmail]);
        if (existing.rows.length > 0) {
          skipped.push({ index: i, name: `${first_name} ${last_name}`, reason: 'Email already exists' });
          continue;
        }
      }

      const tempPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);

      const userResult = await query(
        'INSERT INTO users (email, password, is_deceased) VALUES ($1, $2, $3) RETURNING id',
        [resolvedEmail, tempPassword, is_deceased ?? false]
      );
      const user = userResult.rows[0];

      await query(
        `INSERT INTO profiles (user_id, first_name, last_name, former_first_name, former_last_name)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, first_name.trim(), last_name.trim(), original_first_name?.trim() || null, original_last_name?.trim() || null]
      );

      await query(
        'INSERT INTO class_user (class_id, user_id, school_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [classId, user.id, schoolId]
      );

      created.push({ first_name: first_name.trim(), last_name: last_name.trim() });
    } catch {
      skipped.push({ index: i, name: `${first_name} ${last_name}`, reason: 'Database error' });
    }
  }

  res.status(201).json({ created: created.length, skipped });
});

// GET /api/admin/schools/:id
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

// POST /api/admin/schools
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

// PUT /api/admin/schools/:id
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

// DELETE /api/admin/schools/:id
router.delete('/:id', requireSuperAdmin, async (req: any, res) => {
  const { id } = req.params;
  const cascadeUsers = req.query.cascadeUsers === 'true';

  try {
    await query('BEGIN;');

    if (cascadeUsers) {
      const usersResult = await query(`
        SELECT DISTINCT u.id
        FROM users u
        JOIN class_user cu ON u.id = cu.user_id
        WHERE cu.school_id = $1
      `, [id]);

      for (const user of usersResult.rows) {
        await deleteUserPhotosFromS3(user.id);
      }

      await query(`
        DELETE FROM users
        WHERE id IN (
          SELECT DISTINCT user_id FROM class_user WHERE school_id = $1
        );
      `, [id]);
    }

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
