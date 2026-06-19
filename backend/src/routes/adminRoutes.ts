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

export { router as adminRoutes };