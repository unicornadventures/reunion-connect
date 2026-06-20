# Phase 1: Local Serverless Development Setup

## ✅ Completed

- [x] Install SAM CLI (already installed: v1.162.1)
- [x] Create `template.yaml` with 8 Lambda functions defined
- [x] Create `samconfig.toml` for SAM CLI configuration
- [x] Created Lambda handlers:
  - `backend/src/lambda/auth.ts` - Login, Register, Registration Link
  - `backend/src/lambda/users.ts` - Get Profile
  - `backend/src/lambda/comments.ts` - Create, Get Comments
  - `backend/src/lambda/admin.ts` - Get Users, Update Class Admin
- [x] Updated `package.json` with Lambda build scripts
- [x] Created `tsconfig.lambda.json` for ES module Lambda builds
- [x] `sam build` succeeds - built artifacts ready

## 🚀 Next Steps: Test Locally

### 1. Start LocalStack + PostgreSQL
```bash
docker-compose up -d
```

Wait for PostgreSQL to be healthy (check logs):
```bash
docker-compose logs postgres
```

### 2. Initialize Database
```bash
# Set connection to local postgres
export DATABASE_URL="postgresql://admin:testpass@localhost:5432/class_reunion"

# Run migrations
npm run dev  # This will seed the database on startup
```

### 3. Start SAM Local Server
In a new terminal:
```bash
npm run sam:local
```

This starts the API Gateway emulator on `http://localhost:3001`.

### 4. Test Login Endpoint
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }'
```

Expected response:
```json
{
  "user": {
    "user_id": 1,
    "email": "admin@example.com",
    "is_admin": true,
    "is_class_admin": false
  },
  "token": "eyJhbGc..."
}
```

## 📋 Architecture

```
┌─────────────────────────┐
│   Your Terminal         │
│  (REST API calls)       │
└────────────┬────────────┘
             │
             ↓
┌─────────────────────────┐
│  API Gateway            │  <- sam local start-api
│  (localhost:3001)       │
└────────────┬────────────┘
             │
    ┌────────┼────────┐
    ↓        ↓        ↓
┌──────┐ ┌──────┐ ┌──────┐
│Login │ │Users │ │Admin │  <- Lambda Handlers
│Handler├─┤Handler├─┤Handler├─ (JS compiled from TS)
└──────┘ └──────┘ └──────┘
    │        │        │
    └────────┼────────┘
             ↓
┌─────────────────────────┐
│  PostgreSQL             │
│  (localhost:5432)       │
└─────────────────────────┘
```

## Troubleshooting

**"Cannot connect to PostgreSQL"**
- Check if postgres container is running: `docker ps`
- Check logs: `docker logs classyear-postgres`
- Wait for healthcheck to pass (5-10 seconds)

**"Module not found" errors**
- Rebuild Lambda code: `npm run sam:build`
- Clean dist: `rm -rf dist .aws-sam`

**"Port 3001 already in use"**
- Change port in samconfig.toml (local_start_api.port)
- Or kill existing process: `lsof -i :3001`

## Next Phase (Phase 2)
Once login handler works:
1. Convert remaining auth routes (register, password reset)
2. Convert user routes (profile, photos)
3. Convert comment routes (create, publish, moderate)
4. Convert admin routes (create schools/classes, manage users)

**Estimated time: 4-6 hours**

---

## Useful Commands

```bash
# View SAM config
cat samconfig.toml

# Rebuild Lambda code only
npm run sam:build

# View compiled Lambda handlers
cat dist/src/lambda/auth.js

# Docker management
docker-compose ps          # List containers
docker-compose logs -f     # Follow logs
docker-compose down        # Stop all services
docker volume prune        # Clean up old volumes
```

