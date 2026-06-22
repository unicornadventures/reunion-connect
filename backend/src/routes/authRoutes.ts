import { Router } from 'express';
import { authenticateToken } from '../utils/auth.ts';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.ts';
import { generateResetToken, verifyResetToken } from '../services/tokenService.ts';
import { sendPasswordResetEmail, sendVerificationEmail } from '../services/emailService.ts';
import { decodeRegistrationHash } from '../utils/registrationLink.ts';

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

      res.status(200).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          is_admin: user.is_admin,
          is_class_admin: user.is_class_admin,
          created_at: user.created_at,
          profile: profile || null,
          user_id: user.id,
          first_name: profile?.first_name || '',
          last_name: profile?.last_name || ''
        }
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

// GET /api/auth/registration-link/:hash
router.get('/registration-link/:hash', async (req, res) => {
  const { hash } = req.params;

  try {
    const data = decodeRegistrationHash(hash);
    if (!data) {
      return res.status(400).json({ error: 'Invalid registration link.' });
    }

    const { schoolId, classId } = data;

    // Fetch school info
    const schoolResult = await query('SELECT id, name, location FROM schools WHERE id = $1', [schoolId]);
    if (schoolResult.rows.length === 0) {
      return res.status(404).json({ error: 'School not found.' });
    }

    // Fetch class info — verify this class year is linked to this school
    const classResult = await query(
      `SELECT c.id, c.year FROM classes c
       JOIN class_school cs ON c.id = cs.class_id
       WHERE c.id = $1 AND cs.school_id = $2`,
      [classId, schoolId]
    );
    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found.' });
    }

    res.status(200).json({
      school: schoolResult.rows[0],
      class: classResult.rows[0]
    });
  } catch (error) {
    console.error('Registration Link Decode Error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, confirmPassword, firstName, lastName, schoolId, classId } = req.body;

  if (!email || !password || !confirmPassword) {
    return res.status(400).json({ error: 'Email, password, and password confirmation are required.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const userResult = await query(
      'INSERT INTO users (email, password, is_admin, is_class_admin) VALUES ($1, $2, false, false) RETURNING id, email, is_admin',
      [normalizedEmail, hashedPassword]
    );

    const user = userResult.rows[0];

    // Create profile
    await query(
      'INSERT INTO profiles (user_id, first_name, last_name) VALUES ($1, $2, $3)',
      [user.id, firstName || null, lastName || null]
    );

    // If schoolId and classId provided, add user to class with school context
    if (schoolId && classId) {
      const classExists = await query(
        `SELECT c.id FROM classes c
         JOIN class_school cs ON c.id = cs.class_id
         WHERE c.id = $1 AND cs.school_id = $2`,
        [classId, schoolId]
      );

      if (classExists.rows.length > 0) {
        await query(
          'INSERT INTO class_user (class_id, user_id, school_id) VALUES ($1, $2, $3)',
          [classId, user.id, schoolId]
        );
      }
    }

    // Generate email verification token
    const { token, hash, expiresAt } = generateResetToken();
    await query(
      'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, hash, expiresAt]
    );

    // Send verification email
    await sendVerificationEmail(user.email, token);

    res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      user: {
        id: user.id,
        email: user.email,
        is_admin: user.is_admin
      }
    });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email
    const userResult = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);

    if (userResult.rows.length === 0) {
      // Don't reveal if email exists for security
      return res.status(200).json({ message: 'If the email exists, a password reset link has been sent.' });
    }

    const user = userResult.rows[0];

    // Delete existing reset tokens
    await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);

    // Generate reset token
    const { token, hash, expiresAt } = generateResetToken();
    await query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, hash, expiresAt]
    );

    // Send reset email
    await sendPasswordResetEmail(normalizedEmail, token);

    res.status(200).json({ message: 'If the email exists, a password reset link has been sent.' });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password, confirmPassword } = req.body;

  if (!token || !password || !confirmPassword) {
    return res.status(400).json({ error: 'Token, password, and password confirmation are required.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  try {
    // Find valid reset token
    const tokenResult = await query(
      'SELECT user_id FROM password_reset_tokens WHERE expires_at > NOW() ORDER BY created_at DESC LIMIT 1'
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token.' });
    }

    const resetRecord = tokenResult.rows[0];
    const isValid = verifyResetToken(resetRecord.token_hash, token);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid or expired reset token.' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update user password
    await query(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, resetRecord.user_id]
    );

    // Delete used token
    await query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1',
      [resetRecord.user_id]
    );

    res.status(200).json({ message: 'Password reset successful. You can now login with your new password.' });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/verify-email
router.post('/verify-email', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Verification token is required.' });
  }

  try {
    // Find valid verification token
    const tokenResult = await query(
      'SELECT user_id, token_hash FROM email_verification_tokens WHERE expires_at > NOW() AND verified = FALSE ORDER BY created_at DESC LIMIT 1'
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token.' });
    }

    const verificationRecord = tokenResult.rows[0];
    const isValid = verifyResetToken(verificationRecord.token_hash, token);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid or expired verification token.' });
    }

    // Mark email as verified
    await query(
      'UPDATE users SET email_verified = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [verificationRecord.user_id]
    );

    // Mark token as used
    await query(
      'UPDATE email_verification_tokens SET verified = TRUE WHERE user_id = $1',
      [verificationRecord.user_id]
    );

    res.status(200).json({ message: 'Email verified successfully. You can now login to your account.' });
  } catch (error) {
    console.error('Verify Email Error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export { router as authRoutes };