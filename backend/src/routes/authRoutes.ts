import { Router } from 'express';
import { authenticateToken } from '../utils/auth.ts';
import bcrypt from 'bcryptjs';
import { query } from '../db.ts';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const userResult = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const user = userResult.rows[0];

    // Use bcrypt to compare plain password against secure hash
    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      // Get user profile
      const profileResult = await query('SELECT * FROM profiles WHERE user_id = $1', [user.id]);
      const profile = profileResult.rows[0];

      // Return safe data (Never send user.password back)
      res.status(200).json({
        id: user.id,
        email: user.email,
        is_admin: user.is_admin,
        profile,
        token: 'fake_jwt_token' // Replace with real JWT generation later
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials.' });
    }

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

router.get('/me', authenticateToken, (req: any, res) => {
  // If the token is valid, authenticateToken attaches the user object to req
  if (req.user) {
    return res.json({ user: req.user });
  }
  return res.status(401).json({ error: 'Not authenticated' });
});

export { router as authRoutes };