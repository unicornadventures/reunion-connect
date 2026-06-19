import { Router } from 'express';
import { authenticateToken } from '../utils/auth.ts';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
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

      // Generate JWT token
      const JWT_SECRET = process.env.JWT_SECRET || 'fallback-super-secret-key';
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          is_admin: user.is_admin,
          profile: profile || null,
          user_id: user.id,
          first_name: profile?.first_name || '',
          last_name: profile?.last_name || ''
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Set secure HTTP-only cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      // Return safe data (Never send user.password back)
      res.status(200).json({
        id: user.id,
        email: user.email,
        is_admin: user.is_admin,
        created_at: user.created_at,
        profile,
        user_id: user.id,
        first_name: profile?.first_name || '',
        last_name: profile?.last_name || ''
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

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  res.json({ message: 'Logged out successfully' });
});

export { router as authRoutes };