# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ClassYear** is a class reunion platform. The production target is AWS serverless (Lambda + API Gateway + RDS), but local development runs in two modes:
- **Express dev server** (`npm run dev` in `backend/`) — fast iteration, connects to PostgreSQL via Docker
- **SAM local** (`npm run sam:local`) — emulates Lambda + API Gateway on port 3001 with Docker containers

The frontend is a React/Vite SPA that calls the backend API. The API base URL is configured via `VITE_API_BASE_URL` (defaults to `http://localhost:5001/api` for Express dev, change to `http://localhost:3001` for SAM local).

## Commands

### Backend (run from `backend/` or use root scripts which delegate there)

```bash
# Local development (Express on port 5001, requires .env at root)
npm run dev

# Run Jest tests
npm test
npm test -- src/routes/__tests__/userRoutes.test.ts   # single file
npm test -- --testNamePattern="GET /api/users"         # by name
npm run test:coverage

# SAM/Lambda workflow
npm run sam:build      # tsc -p tsconfig.lambda.json && sam build
npm run sam:local      # starts API Gateway emulator on port 3001
npm run sam:deploy     # deploy to AWS

# Lambda integration tests (hits running SAM local)
npm run test:lambda
npm run test:lambda:verbose
```

### Frontend (run from `frontend/`)

```bash
npm run dev            # Vite dev server on port 5173
npm test               # Vitest unit tests
npm run test:e2e       # Playwright end-to-end tests
npm run build          # Production build
```

### Infrastructure

```bash
docker-compose up -d   # Starts PostgreSQL on port 5432 (required for both dev modes)
docker-compose down -v # Tear down and wipe data
```

## Architecture

### Two Backend Execution Paths

The backend code is structured to support both execution modes:

1. **Express routes** (`backend/src/routes/*.ts`) — used by `server.ts` for local dev. Each route file exports a router mounted in `server.ts`.
2. **Lambda handlers** (`backend/src/lambda/*.ts`) — compiled by `tsconfig.lambda.json` and loaded by SAM. Each handler file exports named async functions that receive `APIGatewayProxyEvent` and return `APIGatewayProxyResult`.

Both paths share `backend/src/db.ts` (PostgreSQL pool), `backend/src/types.ts` (shared interfaces), and `backend/src/utils/`.

### Database Schema

Tables are initialized by `backend/src/schema.ts` (`initializeDatabase()`), called on Express server startup. Schema supports incremental migrations via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

Key entities and relationships:
- `schools` → `classes` (one-to-many, CASCADE delete)
- `classes` ↔ `users` via `class_user` junction table (CASCADE delete)
- `users` → `profiles` (one-to-one, CASCADE delete)
- `users` → `comments` (target_user_id + commenter_id, CASCADE delete)
- `users` → `events` via `class_id` (CASCADE delete)
- `users` → `password_reset_tokens`, `email_verification_tokens` (CASCADE delete)

### Frontend Architecture

- **`src/api.ts`** — axios instance; reads JWT token from `localStorage` and injects as `Authorization` header; base URL from `VITE_API_BASE_URL`
- **`src/apiClient.ts`** — typed wrappers for every API endpoint, organized by domain (authAPI, userAPI, schoolAPI, adminAPI, etc.)
- **`src/context/AppContext.tsx`** — global auth state; persists `currentUser` and `token` to `localStorage`; read on mount
- **`src/components/AppRouter.tsx`** — single router that gates routes by `isAuthenticated`, `is_admin`, and `is_class_admin`

### User Roles

Three role levels enforced in both frontend routing and backend:
- **Regular user** — can view directory, edit own profile, leave comments
- **Class admin** (`is_class_admin`)  — can manage comments for their class
- **Super admin** (`is_admin`) — full access: manage schools, classes, users, toggle class admin

### Auth Flow

JWT is returned from login and stored in `localStorage`. The frontend injects it as `Bearer <token>` on every API call. The Express server uses `authenticateToken` middleware (`src/utils/auth.ts`). Lambda handlers validate the token inline. Cookies are enabled globally via `axios.defaults.withCredentials = true` (see `App.tsx`).

### SAM/Lambda Local Setup

`env-vars.json` at the root provides environment variables for each Lambda function (DB credentials, JWT secret). The SAM local command connects Lambda containers to the `classyear_local` Docker network where PostgreSQL runs as hostname `postgres`. The Docker socket path is hardcoded in `samconfig.toml` — update if running on a different machine.

### Backend Test Architecture

Tests in `backend/src/routes/__tests__/` use a mock database pattern: each test file defines an in-memory `mockDb` object and intercepts `query()` calls via `jest.mock('../../db')`. SQL pattern matching (`sql.includes('...')`) determines which mock data to return. Lambda handler tests in `backend/src/lambda/__tests__/` follow the same pattern. See `backend/CLAUDE.md` for detailed test patterns and coverage notes.

## Local `.env` File

The root `.env` file is loaded by `backend/src/db.ts` (two directories up from `src/`):

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=class_reunion
DB_USER=postgres
DB_PASSWORD=testpass
JWT_SECRET=test-secret-key
FRONTEND_URL=http://localhost:5173
AWS_S3_BUCKET=classyear-dev
AWS_REGION=us-east-1
```

Default test admin: `testadmin@example.com` / `admin123` (seeded by `backend/src/seed.ts`).
