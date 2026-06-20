import express from 'express';
import { query } from '../db.ts';
import { seedAdminUser } from '../seed.ts';

const router = express.Router();

// POST /api/admin/seed
router.post('/seed', async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Missing required field: password.' });
  }

  try {
    await seedAdminUser(password);
    res.status(200).json({ message: 'Admin user seeding completed successfully.' });
  } catch (error: any) {
    console.error("Route Seeding Error:", error.message);
    res.status(500).json({ error: `Failed to seed admin user: ${error.message}` });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        u.id,
        u.email,
        u.is_admin,
        u.created_at,
        p.first_name,
        p.last_name
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      ORDER BY u.created_at DESC;
    `);

    res.status(200).json({ users: result.rows });
  } catch (error: any) {
    console.error("Diagnostic Fetch Users Error:", error.message);
    res.status(500).json({ error: 'Internal server error while fetching user list.' });
  }
});

// DELETE /api/admin/users/:userId
router.delete('/users/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    // Check if user exists
    const userCheck = await query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Delete the user (cascade will handle profiles, comments, class_user, etc.)
    await query('DELETE FROM users WHERE id = $1', [userId]);

    res.status(200).json({ message: 'User deleted successfully.' });
  } catch (error: any) {
    console.error('Delete User Error:', error.message);
    res.status(500).json({ error: 'Internal server error while deleting user.' });
  }
});

// GET /api/admin/classes/:classId/users - Get users with pagination and search (admin)
router.get('/classes/:classId/users', async (req, res) => {
  const { classId } = req.params;
  const page = parseInt(String(req.query.page)) || 1;
  const pageSize = parseInt(String(req.query.pageSize)) || 10;
  const lastName = String(req.query.lastName || '').trim();

  try {
    // Build the WHERE clause
    let whereClause = 'cu.class_id = $1';
    const params: any[] = [classId];

    if (lastName) {
      whereClause += ` AND p.last_name ILIKE $${params.length + 1}`;
      params.push(`${lastName}%`);
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as count FROM class_user cu
       JOIN users u ON cu.user_id = u.id
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    const offset = (page - 1) * pageSize;
    const result = await query(
      `SELECT u.id, u.email, p.first_name, p.last_name
       FROM class_user cu
       JOIN users u ON cu.user_id = u.id
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE ${whereClause}
       ORDER BY p.last_name ASC, p.first_name ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    );

    res.status(200).json({ users: result.rows, total, page, pageSize });
  } catch (error) {
    console.error('Get Class Users Error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export { router as adminRoutes };