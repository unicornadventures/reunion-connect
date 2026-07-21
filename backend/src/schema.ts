import { query } from './db.js';

export async function initializeDatabase() {
  console.log('🔨 Starting database initialization...');

  try {
    // 1. Schools
    await query(`
      CREATE TABLE IF NOT EXISTS schools (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "schools" ensured.');

    // IANA timezone name (e.g. "America/Chicago") used to render event/comment
    // timestamps in the school's local time instead of UTC.
    await query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS timezone VARCHAR(50);`);

    // 2. Classes — global year table, one row per year (no school_id)
    await query(`
      CREATE TABLE IF NOT EXISTS classes (
        id SERIAL PRIMARY KEY,
        year INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "classes" ensured.');

    // 3. class_school pivot (many-to-many: classes ↔ schools)
    await query(`
      CREATE TABLE IF NOT EXISTS class_school (
        class_id INT REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
        school_id INT REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
        PRIMARY KEY (class_id, school_id)
      );
    `);
    console.log('✅ Table "class_school" ensured.');

    // Migration: if classes.school_id still exists (old schema), move to class_school
    await query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'classes' AND column_name = 'school_id'
        ) THEN
          -- Move old school associations to class_school
          INSERT INTO class_school (class_id, school_id)
          SELECT id, school_id FROM classes WHERE school_id IS NOT NULL
          ON CONFLICT DO NOTHING;

          -- Consolidate duplicate year rows — update class_user to kept id
          UPDATE class_user cu
          SET class_id = keep.id
          FROM (SELECT year, MIN(id) AS id FROM classes GROUP BY year) keep
          JOIN classes c ON c.year = keep.year AND c.id != keep.id
          WHERE cu.class_id = c.id;

          -- Consolidate duplicate year rows — update events to kept id
          UPDATE events e
          SET class_id = keep.id
          FROM (SELECT year, MIN(id) AS id FROM classes GROUP BY year) keep
          JOIN classes c ON c.year = keep.year AND c.id != keep.id
          WHERE e.class_id = c.id;

          -- Consolidate duplicate year rows — update class_school to kept id
          UPDATE class_school cs
          SET class_id = keep.id
          FROM (SELECT year, MIN(id) AS id FROM classes GROUP BY year) keep
          JOIN classes c ON c.year = keep.year AND c.id != keep.id
          WHERE cs.class_id = c.id;

          -- Remove duplicate class rows (keep lowest id per year)
          DELETE FROM classes
          WHERE id NOT IN (SELECT MIN(id) FROM classes GROUP BY year);

          -- Drop the now-redundant column
          ALTER TABLE classes DROP COLUMN school_id;
        END IF;
      END $$;
    `);

    // Add UNIQUE constraint on year (safe after deduplication above)
    await query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'classes_year_unique'
        ) THEN
          ALTER TABLE classes ADD CONSTRAINT classes_year_unique UNIQUE (year);
        END IF;
      END $$;
    `);

    // Seed class years 1950 → current year
    await query(`
      INSERT INTO classes (year)
      SELECT generate_series(1950, EXTRACT(YEAR FROM NOW())::INT)
      ON CONFLICT (year) DO NOTHING;
    `);
    console.log('✅ Class years 1950–present seeded.');

    // 4. Users
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        is_class_admin BOOLEAN DEFAULT FALSE,
        email_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "users" ensured.');

    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_class_admin BOOLEAN DEFAULT FALSE;`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deceased BOOLEAN DEFAULT FALSE NOT NULL;`);
    // Allow email/password to be null for admin-created roster entries (no login needed)
    await query(`ALTER TABLE users ALTER COLUMN email DROP NOT NULL;`);
    await query(`ALTER TABLE users ALTER COLUMN password DROP NOT NULL;`);

    // 5. Profiles
    await query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE NOT NULL UNIQUE,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        nickname VARCHAR(100),
        former_first_name VARCHAR(100),
        former_last_name VARCHAR(100),
        bio TEXT,
        then_photo_url VARCHAR(255),
        now_photo_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "profiles" ensured.');

    await query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'profiles' AND column_name = 'nickname_school'
        ) THEN
          ALTER TABLE profiles RENAME COLUMN nickname_school TO nickname;
        END IF;
      END $$;
    `);
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nickname VARCHAR(100)`);
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS former_first_name VARCHAR(100)`);
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS former_last_name VARCHAR(100)`);

    // 6. class_user junction (many-to-many: classes ↔ users, with school context)
    const hasIdColumn = await query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'class_user' AND column_name = 'id'
    `);

    if (hasIdColumn.rows.length === 0) {
      await query('DROP TABLE IF EXISTS class_user CASCADE;');
    }

    await query(`
      CREATE TABLE IF NOT EXISTS class_user (
        id SERIAL PRIMARY KEY,
        class_id INT REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
        user_id INT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        school_id INT REFERENCES schools(id) ON DELETE SET NULL,
        UNIQUE(class_id, user_id)
      );
    `);
    console.log('✅ Table "class_user" ensured.');

    // Add school_id to class_user if not present (migration for existing rows)
    await query(`ALTER TABLE class_user ADD COLUMN IF NOT EXISTS school_id INT REFERENCES schools(id) ON DELETE SET NULL;`);

    // Populate class_user.school_id from class_school where not yet set
    await query(`
      UPDATE class_user cu
      SET school_id = cs.school_id
      FROM class_school cs
      WHERE cu.class_id = cs.class_id AND cu.school_id IS NULL;
    `);

    // 7. Events
    await query(`
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
    `);
    console.log('✅ Table "events" ensured.');

    // Scope events to a specific school (not just a class year)
    await query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS school_id INT REFERENCES schools(id) ON DELETE CASCADE;`);

    // 8. Comments
    await query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        target_user_id INT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        commenter_id INT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        content TEXT NOT NULL,
        published BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "comments" ensured.');

    // Tags on profiles (Feature 5)
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb`);
    await query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE tablename = 'profiles' AND indexname = 'profiles_tags_gin'
        ) THEN
          CREATE INDEX profiles_tags_gin ON profiles USING gin(tags);
        END IF;
      END $$;
    `);

    // Gallery photos (Feature 2)
    await query(`
      CREATE TABLE IF NOT EXISTS gallery_photos (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        s3_key VARCHAR(500) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "gallery_photos" ensured.');

    // 9. Password reset tokens
    await query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "password_reset_tokens" ensured.');

    // 10. Email verification tokens
    await query(`
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "email_verification_tokens" ensured.');

    console.log('🚀 Database schema initialization complete!');

  } catch (error) {
    console.error('❌ FATAL: Could not initialize database schema.', error);
  }
}
