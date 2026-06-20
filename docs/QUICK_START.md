# ServerlessClassYear - Quick Start Guide

## 🚀 Local Development

### 1. Start Infrastructure
```bash
docker-compose up -d
# Waits for postgres:5432 to be healthy
```

### 2. Build Lambda Functions
```bash
npm run sam:build
# Compiles TypeScript → JS in dist/, creates .aws-sam/build
```

### 3. Start API Server
```bash
npm run sam:local
# Starts API Gateway emulator on http://localhost:3001
```

### 4. Test Login (Example)
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testadmin@example.com",
    "password": "admin123"
  }'
```

---

## 📊 Architecture

```
User Request
    ↓
API Gateway (http://localhost:3001)
    ↓
Lambda Function Handler (e.g., loginHandler)
    ↓
PostgreSQL Database (localhost:5432)
    ↓
Response (JSON)
```

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `template.yaml` | SAM infrastructure (34 Lambda functions + API Gateway) |
| `samconfig.toml` | SAM CLI local config (port 3001, parameters) |
| `docker-compose.yml` | PostgreSQL + LocalStack containers |
| `.env` | Database credentials |
| `backend/src/lambda/*.ts` | Lambda handler code |
| `backend/dist/lambda/*.js` | Compiled handlers (auto-generated) |

---

## 🔑 Environment Variables (in .env)

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=class_reunion
DB_USER=admin
DB_PASSWORD=testpass
JWT_SECRET=test-secret-key
FRONTEND_URL=http://localhost:5173
AWS_S3_BUCKET=classyear-dev
AWS_REGION=us-east-1
```

---

## ✅ Test User (Pre-populated)

| Email | Password | Role |
|-------|----------|------|
| testadmin@example.com | admin123 | Super Admin |

---

## 🌐 Available Endpoints (34 total)

### Auth
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/registration-link/{hash}`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

### Users
- `GET /api/users/{userId}`
- `PUT /api/users/{userId}/profile`
- `GET /api/users/{userId}/class`
- `GET /api/users` (paginated directory)

### Comments
- `POST /api/users/{userId}/comments`
- `GET /api/users/{userId}/comments` (published only)
- `GET /api/users/{userId}/comments/pending` (auth checked)
- `PUT /api/comments/{commentId}` (publish/edit)
- `DELETE /api/comments/{commentId}`

### Admin
- `GET /api/admin/users`
- `DELETE /api/admin/users/{userId}`
- `GET /api/admin/classes/{classId}/users`
- `PUT /api/admin/users/{userId}` (toggle class admin)
- `POST /api/admin/registration-links`

### Schools
- `GET /api/schools`
- `GET /api/schools/{schoolId}`
- `POST /api/admin/schools`

### Classes
- `GET /api/schools/{schoolId}/classes`
- `GET /api/classes/{classId}`
- `POST /api/admin/schools/{schoolId}/classes`
- `GET /api/classes/{classId}/members`

### Events
- `GET /api/classes/{classId}/events`
- `GET /api/events/{eventId}`
- `POST /api/admin/classes/{classId}/events`
- `PUT /api/events/{eventId}`
- `DELETE /api/events/{eventId}`

### Photos
- `POST /api/users/{userId}/photo/{photoType}` (then/now)
- `DELETE /api/users/{userId}/photo/{photoType}`
- `GET /api/photos/{photoKey}/presigned`

---

## 🧪 Common Test Flows

### Register New User
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "password123",
    "first_name": "John",
    "last_name": "Doe",
    "schoolId": 1,
    "classId": 1
  }'
```

### Create Comment
```bash
curl -X POST http://localhost:3001/api/users/2/comments \
  -H "Content-Type: application/json" \
  -d '{
    "commenterId": 1,
    "content": "Great to see you at the reunion!"
  }'
```

### Publish Comment (Admin Only)
```bash
curl -X PUT http://localhost:3001/api/comments/1 \
  -H "Content-Type: application/json" \
  -d '{
    "published": true,
    "requesterId": 1
  }'
```

---

## 🔧 Troubleshooting

### PostgreSQL Connection Fails
```bash
# Restart containers
docker-compose down -v
docker-compose up -d

# Wait 10 seconds for healthy status
docker-compose ps
```

### Port Already in Use
```bash
# Kill process on port 3001
lsof -i :3001 | awk 'NR!=1 {print $2}' | xargs kill -9

# Or change port in samconfig.toml
```

### Lambda Compilation Error
```bash
# Rebuild TypeScript
npm run sam:build

# Clear build artifacts
rm -rf dist .aws-sam
```

---

## 📦 Deployment to AWS

### Prerequisites
```bash
aws configure
# Enter AWS Access Key, Secret Key, Region
```

### Deploy
```bash
sam deploy --guided
# Follow prompts, or use:
sam deploy \
  --stack-name classyear-prod \
  --s3-bucket classyear-artifacts \
  --region us-east-1 \
  --capabilities CAPABILITY_IAM
```

---

## 📚 Documentation Files

- `SERVERLESS_RESEARCH.md` - Deep dive into serverless architecture
- `PHASE1_SETUP.md` - Initial environment setup
- `PHASE2_PROGRESS.md` - First batch of handlers
- `PHASE2_COMPLETE.md` - All 34 handlers complete
- `QUICK_START.md` - This file

---

## 🎯 Next Steps

- [ ] Test all endpoints locally with `npm run sam:local`
- [ ] Set up frontend React app to call these endpoints
- [ ] Deploy to AWS using `sam deploy --guided`
- [ ] Set up CloudFront CDN for frontend
- [ ] Configure domain name
- [ ] Enable HTTPS/TLS
- [ ] Set up monitoring with CloudWatch

---

**Ready to ship serverless! 🚀**

Built with SAM, Lambda, API Gateway, RDS PostgreSQL
