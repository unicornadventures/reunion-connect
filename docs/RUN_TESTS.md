# How to Run Automated Tests

## 🚀 One-Command Testing

### Run From Any Directory ✅

```bash
# From backend directory
cd backend && npm run test:lambda

# OR from project root
npm run test:lambda
```

Either location works! The script auto-detects your position.

This will:

1. Check if PostgreSQL is running (start if needed)
2. Build all Lambda functions
3. Start SAM local API server on http://localhost:3001
4. Run all 34 endpoint tests automatically
5. Display pass/fail results with coverage by module
6. Cleanup and exit

**Total time:** 2-3 minutes
**Expected output:** All tests pass ✅

---

## 📊 What Happens

```
🚀 Starting automated Lambda endpoint test suite...

Checking Docker containers...
✅ Database ready

Starting SAM local server...
✅ SAM server started

Waiting for API server to be ready...
✅ API server ready

1️⃣  AUTH ENDPOINTS (5 tests)

✅ POST /api/auth/login (200)
✅ POST /api/auth/register (201)
✅ GET /api/auth/registration-link/{hash} (200)
✅ POST /api/auth/forgot-password (200)
✅ POST /api/auth/reset-password (200)

2️⃣  USER ENDPOINTS (4 tests)
✅ GET /api/users/{userId} (200)
✅ PUT /api/users/{userId}/profile (200)
✅ GET /api/users/{userId}/class (200)
✅ GET /api/users (directory) (200)

... (continues for all 34 endpoints)

========================================
   TEST RESULTS
========================================

✅ Passed: 34/34 (100%)

Endpoint Coverage by Module:

  Auth:      5/5  ✅
  Users:     4/4  ✅
  Comments:  5/5  ✅
  Admin:     4/4  ✅
  Schools:   3/3  ✅
  Classes:   4/4  ✅
  Events:    5/5  ✅
  Photos:    3/3  ✅

========================================
```

---

## 🎯 Different Testing Scenarios

### Scenario A: Quick Test (Automated)
```bash
npm run test:lambda
# Fastest: runs all tests, shows summary, exits
```

### Scenario B: Keep Server Running (Manual Testing)
```bash
# Terminal 1: Start server
npm run sam:local

# Terminal 2: Test specific endpoint
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"testadmin@example.com","password":"admin123"}'
```

### Scenario C: Debug Failed Test
```bash
# Terminal 1: Start server with debug output
sam local start-api --port 3001 --debug

# Terminal 2: Run test
npm run test:lambda

# Terminal 3: Check database state
docker exec classyear-postgres psql -U admin -d class_reunion -c "SELECT * FROM users LIMIT 5;"
```

### Scenario D: Continuous Integration (GitHub Actions)
```bash
# No action needed - tests run automatically on:
# - git push to main or develop
# - Pull requests to main or develop
# Results shown as PR comment
```

---

## 🔍 Understanding the Test Output

### ✅ Test Passed
```
✅ POST /api/auth/login (200)
```
- Endpoint received request
- Returned expected status code (200)
- Response validation passed

### ❌ Test Failed
```
❌ POST /api/auth/login (Got 500, expected 200)
   Error: Invalid credentials.
```
- Endpoint returned wrong status code
- Check error message for details
- May indicate database issue or Lambda code bug

---

## 🐛 If Tests Fail

### Step 1: Read the error
```
❌ POST /api/auth/login (Got 500, expected 200)
   Error: Database connection refused
```

### Step 2: Check prerequisites
```bash
# Is PostgreSQL running?
docker-compose ps

# Is SAM server running?
curl http://localhost:3001/health
```

### Step 3: Verify database state
```bash
# Check if database exists
docker exec classyear-postgres psql -U admin -d class_reunion -c "SELECT COUNT(*) FROM users;"

# Check if tables exist
docker exec classyear-postgres psql -U admin -d class_reunion -c "\dt"
```

### Step 4: Check Lambda code
```bash
# View compiled Lambda handler
cat backend/dist/src/lambda/auth.js | head -30

# Rebuild if needed
npm run sam:build
```

### Step 5: Test manually
```bash
npm run sam:local
# In another terminal:
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"testadmin@example.com","password":"admin123"}' | jq .
```

---

## 📋 Test Coverage

All 34 endpoints tested:

| Module | Endpoints | Status |
|--------|-----------|--------|
| Auth | 5 | ✅ |
| Users | 4 | ✅ |
| Comments | 5 | ✅ |
| Admin | 4 | ✅ |
| Schools | 3 | ✅ |
| Classes | 4 | ✅ |
| Events | 5 | ✅ |
| Photos | 3 | ✅ |

---

## 🚀 Next Steps After Tests Pass

Once `npm run test:lambda` shows all ✅:

1. **Deploy to AWS** (Option 1)
   ```bash
   sam deploy --guided
   ```

2. **Connect Frontend** (Option 2)
   ```bash
   # Update frontend API URL
   npm run build
   npm run deploy:frontend
   ```

3. **Load Testing** (Option 3)
   ```bash
   # Modify test-lambda-endpoints.js to run 100+ requests
   npm run test:lambda:heavy
   ```

---

## 💾 Test Files

| File | Purpose |
|------|---------|
| `test-lambda-endpoints.js` | Main test suite (Node.js) |
| `.github/workflows/test-lambda.yml` | GitHub Actions CI/CD |
| `TESTING_GUIDE.md` | Detailed testing documentation |
| `backend/package.json` | npm scripts for testing |

---

## ✅ Verify Your Setup

Before running tests, ensure you have:

```bash
# Check Node.js
node --version
# Expected: v18+

# Check npm
npm --version
# Expected: v8+

# Check Docker
docker --version
# Expected: Docker 20+

# Check SAM CLI
sam --version
# Expected: SAM CLI 1.15+

# Check docker-compose
docker-compose --version
# Expected: Docker Compose 1.29+
```

---

## 🎯 Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run test:lambda` | Run all tests (recommended) |
| `npm run sam:build` | Just build Lambda functions |
| `npm run sam:local` | Start API server (manual testing) |
| `npm test` | Run backend Jest tests |
| `docker-compose ps` | Check container status |
| `docker-compose logs postgres` | View database logs |

---

## 🎉 Success!

When you see:
```
✅ Passed: 34/34 (100%)
```

Your serverless backend is ready to:
- Deploy to AWS
- Connect with frontend
- Handle production traffic

**All endpoints tested and working! 🚀**

