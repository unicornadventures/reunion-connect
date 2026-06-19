import { query } from './db.ts';

/**
 * Creates the necessary database tables based on the data model design.
 * @returns Promise<void>
 */
export async function initializeDatabase() {
  console.log('🔨 Starting database initialization...');

  try {
    // 1. Create School Table
    const createSchoolTable = `
      CREATE TABLE IF NOT EXISTS schools (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await query(createSchoolTable);
    console.log('✅ Table "schools" ensured.');

    // 2. Create Class Table
    const createClassTable = `
      CREATE TABLE IF NOT EXISTS classes (
        id SERIAL PRIMARY KEY,
        school_id INT REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
        year INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await query(createClassTable);
    console.log('✅ Table "classes" ensured.');

    // 3. Create User Table - Auth only
    const createUserTable = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        is_class_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await query(createUserTable);
    console.log('✅ Table "users" ensured.');

    // Add is_class_admin column if it doesn't exist (for existing databases)
    const addClassAdminColumn = `
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_class_admin BOOLEAN DEFAULT FALSE;
    `;
    await query(addClassAdminColumn);

    // 4. Create Profile Table - User profile data
    const createProfileTable = `
      CREATE TABLE IF NOT EXISTS profiles (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE NOT NULL UNIQUE,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        nickname_school VARCHAR(100),
        bio TEXT,
        then_photo_url VARCHAR(255),
        now_photo_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await query(createProfileTable);
    console.log('✅ Table "profiles" ensured.');

    // 5. Junction Table: Class to User (Many-to-Many)
    // Check if table exists and has the right schema
    const checkClassUserTable = `
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'class_user' AND column_name = 'id'
    `;
    const hasIdColumn = await query(checkClassUserTable);

    if (hasIdColumn.rows.length === 0) {
      // Table doesn't exist or doesn't have id column - drop and recreate
      await query('DROP TABLE IF EXISTS class_user CASCADE;');
    }

    const createClassUserTable = `
      CREATE TABLE IF NOT EXISTS class_user (
        id SERIAL PRIMARY KEY,
        class_id INT REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
        user_id INT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        UNIQUE(class_id, user_id)
      );
    `;
    await query(createClassUserTable);
    console.log('✅ Table "class_user" ensured.');

    // 6. Create Events Table
    const createEventsTable = `
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        class_id INT REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
        event_name VARCHAR(255) NOT NULL,
        event_date DATE NOT NULL,
        event_time TIME NOT NULL,
        location VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await query(createEventsTable);
    console.log('✅ Table "events" ensured.');

    // 7. Create Comment Table
    const createCommentTable = `
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        target_user_id INT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        commenter_id INT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        content TEXT NOT NULL,
        published BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await query(createCommentTable);
    console.log('✅ Table "comments" ensured.');

    console.log('🚀 Database schema initialization complete!');

  } catch (error) {
    console.error('❌ FATAL: Could not initialize database schema.', error);
  }
}