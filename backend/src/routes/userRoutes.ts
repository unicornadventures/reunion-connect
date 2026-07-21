import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.ts';
import { isValidAvatarColor } from '../utils/avatarColors.ts';

const router = express.Router();
const SALT_ROUNDS = 10;

// Helper function to check if two users are in the same class
async function areUsersInSameClass(userId1: number, userId2: number): Promise<boolean> {
  try {
    const result = await query(`
      SELECT cu1.class_id
      FROM class_user cu1
      JOIN class_user cu2 ON cu1.class_id = cu2.class_id
      WHERE cu1.user_id = $1 AND cu2.user_id = $2
      LIMIT 1;
    `, [userId1, userId2]);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking class membership:', error);
    return false;
  }
}

// POST /api/users/register
router.post('/register', async (req, res) => {
  const { email, first_name, last_name, password, class_id } = req.body;

  if (!email || !first_name || !last_name || !password || !class_id) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    // Start a transaction to guarantee data integrity
    await query('BEGIN');

    // 1. Verify class exists
    const classCheck = await query('SELECT id FROM classes WHERE id = $1', [class_id]);
    if (classCheck.rows.length === 0) {
      await query('ROLLBACK');
      return res.status(400).json({ error: 'Provided class_id does not exist.' });
    }

    // 2. Hash password securely
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // 3. Insert user
    const userResult = await query(
      'INSERT INTO users (email, password, is_admin) VALUES ($1, $2, $3) RETURNING id, email, is_admin, created_at;',
      [email.toLowerCase().trim(), hashedPassword, false]
    );

    const newUser = userResult.rows[0];

    // 4. Create user profile
    await query(
      'INSERT INTO profiles (user_id, first_name, last_name) VALUES ($1, $2, $3);',
      [newUser.id, first_name, last_name]
    );

    // 5. Link user to class
    await query('INSERT INTO class_user (class_id, user_id) VALUES ($1, $2);', [class_id, newUser.id]);

    // Commit transaction
    await query('COMMIT');

    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        is_admin: newUser.is_admin,
        created_at: newUser.created_at
      }
    });

  } catch (error: any) {
    await query('ROLLBACK');

    // Handle duplicate email constraint (PostgreSQL error code 23505)
    if (error.code === '23505') {
      return res.status(409).json({ error: 'User already exists.' });
    }

    console.error("Registration Error:", error.message);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// GET /api/users/:id
// Optional query param: requesterId - if provided, validates that requester is in same class or is the user
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { requesterId } = req.query;

  try {
    // If requesterId is provided, validate access
    if (requesterId && requesterId !== id) {
      const requesterId_num = parseInt(String(requesterId));
      const id_num = parseInt(id);

      // Check if requester is admin
      const requesterResult = await query('SELECT is_admin FROM users WHERE id = $1', [requesterId_num]);
      const isAdmin = requesterResult.rows.length > 0 && requesterResult.rows[0].is_admin;

      // If not admin, check if in same class
      if (!isAdmin) {
        const inSameClass = await areUsersInSameClass(requesterId_num, id_num);
        if (!inSameClass) {
          return res.status(403).json({ error: 'Access denied. You can only view profiles from your class.' });
        }
      }
    }

    const userResult = await query('SELECT id, email, is_admin, created_at, updated_at FROM users WHERE id = $1', [id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = userResult.rows[0];

    // Get user profile
    const profileResult = await query('SELECT * FROM profiles WHERE user_id = $1', [id]);
    const profile = profileResult.rows[0] || null;

    res.status(200).json({ user, profile });

  } catch (error) {
    console.error("Get User Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/users/:id/class - Get user's class information
router.get('/:id/class', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(`
      SELECT c.id, c.year, cu.school_id, s.name AS school_name
      FROM class_user cu
      JOIN classes c ON cu.class_id = c.id
      LEFT JOIN schools s ON cu.school_id = s.id
      WHERE cu.user_id = $1
      LIMIT 1;
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User class not found.' });
    }

    res.status(200).json({ class: result.rows[0] });

  } catch (error) {
    console.error("Get User Class Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/users/:userId/assign-class
router.post('/:userId/assign-class', async (req: any, res) => {
  const { userId } = req.params;
  const { class_id } = req.body;

  if (!class_id) {
    return res.status(400).json({ error: 'class_id is required.' });
  }

  try {
    // Check if user exists
    const userCheck = await query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check if class exists
    const classCheck = await query('SELECT id FROM classes WHERE id = $1', [class_id]);
    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found.' });
    }

    // Check if already assigned
    const existingAssignment = await query(
      'SELECT id FROM class_user WHERE user_id = $1 AND class_id = $2',
      [userId, class_id]
    );

    if (existingAssignment.rows.length > 0) {
      return res.status(400).json({ error: 'User already assigned to this class.' });
    }

    // Assign user to class
    await query(
      'INSERT INTO class_user (class_id, user_id) VALUES ($1, $2)',
      [class_id, userId]
    );

    res.status(200).json({ message: 'User assigned to class successfully.' });
  } catch (error) {
    console.error("Assign User to Class Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/users/:userId/profile - Update user profile and email
router.put('/:userId/profile', async (req: any, res) => {
  const { userId } = req.params;
  const { bio, nickname, email, first_name, last_name, former_first_name, former_last_name, tags, avatar_color } = req.body;

  if (avatar_color !== undefined && avatar_color !== null && !isValidAvatarColor(avatar_color)) {
    return res.status(400).json({ error: 'Invalid avatar color.' });
  }

  try {
    // Check if user exists
    const userCheck = await query('SELECT id, email FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const currentUser = userCheck.rows[0];

    // Check if profile exists
    const profileCheck = await query('SELECT id FROM profiles WHERE user_id = $1', [userId]);
    if (profileCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    // If email is being changed, validate and check for duplicates
    if (email && email !== currentUser.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format.' });
      }

      const duplicateEmail = await query('SELECT id FROM users WHERE email = $1 AND id != $2', [email.toLowerCase().trim(), userId]);
      if (duplicateEmail.rows.length > 0) {
        return res.status(409).json({ error: 'Email already in use.' });
      }

      // Update user email
      await query('UPDATE users SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [email.toLowerCase().trim(), userId]);
    }

    // Update profile with provided fields
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    const profileFields: Record<string, any> = { bio, nickname, first_name, last_name, former_first_name, former_last_name, avatar_color };
    for (const [field, val] of Object.entries(profileFields)) {
      if (val !== undefined) {
        updateFields.push(`${field} = $${paramCount}`);
        updateValues.push(val);
        paramCount++;
      }
    }

    if (tags !== undefined) {
      updateFields.push(`tags = $${paramCount}`);
      updateValues.push(JSON.stringify(tags));
      paramCount++;
    }

    if (updateFields.length === 0 && !email) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    let result;
    if (updateFields.length > 0) {
      updateValues.push(userId);
      const updateQuery = `UPDATE profiles SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = $${paramCount} RETURNING *`;
      result = await query(updateQuery, updateValues);
    } else {
      // If only email was updated, fetch the profile
      result = await query('SELECT * FROM profiles WHERE user_id = $1', [userId]);
    }

    res.status(200).json({ profile: result.rows[0] });
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export { router as userRoutes };