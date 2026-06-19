# API Endpoints Documentation

## Base URL
`http://localhost:5001/api` (or as configured in environment)

## Authentication Endpoints

### POST /auth/login
Login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "is_admin": false,
  "profile": {
    "id": 1,
    "user_id": 1,
    "first_name": "John",
    "last_name": "Doe",
    "nickname_school": "JD",
    "bio": "Hello there",
    "then_photo_url": "https://...",
    "now_photo_url": "https://...",
    "created_at": "2025-06-19T10:00:00Z",
    "updated_at": "2025-06-19T10:00:00Z"
  },
  "token": "jwt_token_here"
}
```

### GET /auth/me
Get current authenticated user.

**Response:**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "is_admin": false,
    "created_at": "2025-06-19T10:00:00Z",
    "profile": { ... }
  }
}
```

### POST /auth/logout
Logout current user.

---

## User Endpoints

### POST /users/register
Register a new user.

**Request:**
```json
{
  "email": "newuser@example.com",
  "password": "securepassword123",
  "first_name": "Jane",
  "last_name": "Smith",
  "class_id": 5
}
```

**Response:**
```json
{
  "user": {
    "id": 2,
    "email": "newuser@example.com",
    "is_admin": false,
    "created_at": "2025-06-19T11:00:00Z"
  }
}
```

**Note:** The endpoint creates both a User record and a Profile record in a single transaction.

### GET /users/:id
Get user details with profile.

**Response:**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "is_admin": false,
    "created_at": "2025-06-19T10:00:00Z",
    "updated_at": "2025-06-19T10:00:00Z"
  },
  "profile": {
    "id": 1,
    "user_id": 1,
    "first_name": "John",
    "last_name": "Doe",
    "nickname_school": "JD",
    "bio": "Class of 2020",
    "then_photo_url": "https://...",
    "now_photo_url": "https://...",
    "created_at": "2025-06-19T10:00:00Z",
    "updated_at": "2025-06-19T10:00:00Z"
  }
}
```

### POST /users/:userId/photo/upload/:photoType
Generate presigned URL for photo upload.

**Parameters:**
- `:userId` - User ID
- `:photoType` - "then" or "now"

**Request:**
```json
{
  "fileName": "my_photo.jpg"
}
```

**Response:**
```json
{
  "presignedUrl": "https://s3.aws.com/presigned/1/my_photo.jpg"
}
```

### PUT /users/:userId/photo/:photoType
Update photo URL in user profile.

**Parameters:**
- `:userId` - User ID
- `:photoType` - "then" or "now"

**Request:**
```json
{
  "photoUrl": "https://s3.aws.com/bucket/photo.jpg"
}
```

**Response:**
```json
{
  "profile": {
    "id": 1,
    "user_id": 1,
    "then_photo_url": "https://s3.aws.com/bucket/photo.jpg",
    "now_photo_url": "...",
    ...
  }
}
```

---

## School Endpoints

### GET /schools
List all schools.

**Response:**
```json
{
  "schools": [
    {
      "id": 1,
      "name": "Lincoln High School",
      "location": "Los Angeles, CA",
      "created_at": "2025-06-19T10:00:00Z",
      "updated_at": "2025-06-19T10:00:00Z"
    }
  ]
}
```

### GET /schools/:id
Get specific school.

**Response:**
```json
{
  "school": {
    "id": 1,
    "name": "Lincoln High School",
    "location": "Los Angeles, CA",
    "created_at": "2025-06-19T10:00:00Z",
    "updated_at": "2025-06-19T10:00:00Z"
  }
}
```

### POST /schools
Create a new school.

**Request:**
```json
{
  "name": "Washington High School",
  "location": "Seattle, WA"
}
```

**Response:**
```json
{
  "school": {
    "id": 2,
    "name": "Washington High School",
    "location": "Seattle, WA",
    "created_at": "2025-06-19T11:00:00Z",
    "updated_at": "2025-06-19T11:00:00Z"
  }
}
```

---

## Class Endpoints

### GET /classes
List all classes.

**Response:**
```json
{
  "classes": [
    {
      "id": 1,
      "year": 2020,
      "school_id": 1,
      "school_name": "Lincoln High School",
      "created_at": "2025-06-19T10:00:00Z",
      "updated_at": "2025-06-19T10:00:00Z"
    }
  ]
}
```

### GET /classes/:id
Get specific class.

**Response:**
```json
{
  "class": {
    "id": 1,
    "year": 2020,
    "school_id": 1,
    "school_name": "Lincoln High School",
    "created_at": "2025-06-19T10:00:00Z",
    "updated_at": "2025-06-19T10:00:00Z"
  }
}
```

### POST /classes
Create a new class.

**Request:**
```json
{
  "school_id": 1,
  "year": 2025
}
```

**Response:**
```json
{
  "class": {
    "id": 2,
    "school_id": 1,
    "year": 2025,
    "created_at": "2025-06-19T11:00:00Z",
    "updated_at": "2025-06-19T11:00:00Z"
  }
}
```

### GET /classes/:id/members
List all users in a class.

**Response:**
```json
{
  "members": [
    {
      "id": 1,
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "nickname_school": "JD"
    }
  ]
}
```

---

## Admin Endpoints

### POST /admin/seed
Seed an admin user.

**Request:**
```json
{
  "password": "admin_password_123"
}
```

**Response:**
```json
{
  "message": "Admin user seeding completed successfully."
}
```

**Note:** Admin email is hardcoded to `admin@reunion.com`. This endpoint will skip if admin already exists.

### GET /admin/users
Get all users (admin only endpoint).

**Response:**
```json
{
  "users": [
    {
      "id": 1,
      "email": "user@example.com",
      "is_admin": false,
      "created_at": "2025-06-19T10:00:00Z",
      "first_name": "John",
      "last_name": "Doe"
    }
  ]
}
```

---

## Error Responses

All endpoints return appropriate HTTP status codes:

- **400** - Bad Request (missing/invalid parameters)
- **401** - Unauthorized (authentication required or invalid credentials)
- **403** - Forbidden (insufficient permissions)
- **404** - Not Found
- **409** - Conflict (e.g., duplicate email)
- **500** - Internal Server Error

**Error Response Format:**
```json
{
  "error": "Description of what went wrong"
}
```

---

## Data Types

### User
```typescript
{
  id: number;
  email: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}
```

### Profile
```typescript
{
  id: number;
  user_id: number;
  first_name: string | null;
  last_name: string | null;
  nickname_school: string | null;
  bio: string | null;
  then_photo_url: string | null;
  now_photo_url: string | null;
  created_at: string;
  updated_at: string;
}
```

### School
```typescript
{
  id: number;
  name: string;
  location: string | null;
  created_at: string;
  updated_at: string;
}
```

### Class
```typescript
{
  id: number;
  school_id: number;
  year: number;
  created_at: string;
  updated_at: string;
}
```

### Comment
```typescript
{
  id: number;
  target_user_id: number;
  commenter_id: number;
  content: string;
  published: boolean;
  created_at: string;
  updated_at: string;
}
```
