# Database Migration Summary

## Overview
Refactored the application database schema and API to align with the architecture design document. The changes separate authentication concerns from user profile data and simplify the class-user relationship.

## Schema Changes

### Tables Restructured

#### 1. **users** table (simplified)
**Before:**
- user_id, email, keyword, is_admin, first_name, last_name, nickname_school, phone, bio, address, then_photo_url, now_photo_url, is_first_name_public

**After:**
- id, email, password, is_admin, created_at, updated_at

**Rationale:** User table now contains only authentication data. Profile data moved to separate table.

#### 2. **NEW: profiles** table
Created to store user profile information separately.

**Columns:**
- id (PK)
- user_id (FK to users, UNIQUE)
- first_name, last_name, nickname_school, bio
- then_photo_url, now_photo_url
- created_at, updated_at

**Rationale:** Separates authentication from profile data, allowing users without profiles and better data organization.

#### 3. **schools** table
- Column naming: school_id → id
- Added: created_at, updated_at timestamps
- Added ON DELETE CASCADE to foreign keys

#### 4. **classes** table
- Column naming: class_id → id
- Added: created_at, updated_at timestamps
- Added ON DELETE CASCADE to foreign keys

#### 5. **user_school** table
**Removed** - users no longer directly connect to schools; they connect via classes.

#### 6. **user_class** table → **class_user**
- Renamed for consistency and clarity
- Primary key order: (class_id, user_id) - matches junction table convention
- Added ON DELETE CASCADE

#### 7. **comments** table
- Column naming: comment_id → id
- Column rename: is_published → published
- Added: updated_at timestamp

## API Changes

### Authentication Routes (`/api/auth`)
- **POST /login**: Now returns profile data along with user data
- Fixed import path: `../util/auth.ts` → `../utils/auth.ts`

### User Routes (`/api/users`)
- **POST /register**: 
  - Removed school_id requirement
  - Now creates both User and Profile records in transaction
  - Accepts: email, password, first_name, last_name, class_id
  - Returns user with creation timestamp
- **GET /users/:id** (new): Fetches user and profile data

### School Routes (`/api/schools`)
- **GET /schools**: List all schools
- **GET /schools/:id**: Get specific school
- **POST /schools**: Create new school (accepts: name, location)

### Class Routes (`/api/classes`)
- **GET /classes**: List all classes with school info
- **GET /classes/:id**: Get specific class
- **POST /classes**: Create class (accepts: school_id, year)
- **GET /classes/:id/members** (new): List all users in a class

### Photo Routes (`/api/users/:userId/photo`)
- **POST /upload/:photoType**: Generate presigned URL (accepts: "then" or "now")
- **PUT /:photoType** (new): Update photo URL in user profile

### Admin Routes (`/api/admin`)
- **GET /users**: Lists all users with profile data
- **POST /seed**: Creates admin user with profile

## Type Definitions Updated (types.ts)
- Removed duplicate interfaces
- Updated User interface to match new schema
- Added Profile interface
- Updated Comment interface to use "published" and "id"
- UserRegisterInput now requires: email, password, first_name, last_name, class_id

## Data Consistency
- All operations within registration, admin seeding, and updates use transactions
- Foreign key constraints with ON DELETE CASCADE for data integrity
- Timestamps (created_at, updated_at) maintained automatically by database

## Migration Path
To migrate existing data:

```sql
-- 1. Create new tables (handled by schema.ts)
-- 2. Migrate user data
INSERT INTO users (email, password, is_admin, created_at, updated_at)
SELECT email, keyword, is_admin, created_at, updated_at
FROM old_users;

-- 3. Migrate profile data
INSERT INTO profiles (user_id, first_name, last_name, nickname_school, bio, then_photo_url, now_photo_url)
SELECT user_id, first_name, last_name, nickname_school, bio, then_photo_url, now_photo_url
FROM old_users;

-- 4. Migrate class relationships
INSERT INTO class_user (class_id, user_id)
SELECT class_id, user_id FROM old_user_class;

-- 5. Drop old tables
DROP TABLE user_school, old_user_class, old_users;
```

## Files Modified
- `backend/src/schema.ts` - Updated table definitions
- `backend/src/types.ts` - Updated TypeScript interfaces
- `backend/src/routes/authRoutes.ts` - Updated auth endpoints
- `backend/src/routes/userRoutes.ts` - Updated user registration and retrieval
- `backend/src/routes/schoolRoutes.ts` - Implemented school endpoints
- `backend/src/routes/classRoutes.ts` - Implemented class endpoints
- `backend/src/routes/photoRoutes.ts` - Updated photo endpoints
- `backend/src/routes/adminRoutes.ts` - Updated admin endpoints
- `backend/src/seed.ts` - Updated admin seeding for new schema

## Next Steps
1. Test database initialization with new schema
2. Test user registration flow (creates both User and Profile)
3. Verify profile retrieval with user data
4. Update frontend API calls to match new endpoints
5. Implement real AWS S3 presigned URL generation
6. Add JWT token generation to login endpoint
