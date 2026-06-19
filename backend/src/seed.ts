import bcrypt from 'bcryptjs';
import { query } from './db.ts';

const SALT_ROUNDS = 10;

export async function seedAdminUser(password: string) {
  console.log('🔨 Starting global admin user seeding process...');

  try {
    await query('BEGIN');

    // 1. Check for duplicates to protect against primary key violations
    const existingUser = await query('SELECT id FROM users WHERE email = $1', ['admin@reunion.com']);
    if (existingUser.rows.length > 0) {
      console.warn('⚠️ Admin user already exists. Skipping creation.');
      await query('ROLLBACK');
      return;
    }

    // 2. Hash the incoming password string
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // 3. Create admin user
    const result = await query(
      'INSERT INTO users (email, password, is_admin) VALUES ($1, $2, $3) RETURNING id;',
      ['admin@reunion.com', hashedPassword, true]
    );

    const adminUserId = result.rows[0].id;

    // 4. Create admin profile
    await query(
      'INSERT INTO profiles (user_id, first_name, last_name) VALUES ($1, $2, $3);',
      [adminUserId, 'Admin', 'Administrator']
    );

    await query('COMMIT');
    console.log('🎉 Global Admin User created successfully! ID:', adminUserId);

  } catch (error: any) {
    await query('ROLLBACK');
    console.error('❌ FATAL: Failed to seed admin user.', error.message);
    throw error;
  }
}