# Automated Testing Guide - Lambda Endpoints

## 🎯 Quick Start

### Local Testing (1 command)
```bash
npm run test:lambda
```

This will:
1. ✅ Start PostgreSQL container
2. ✅ Start SAM local API server
3. ✅ Run all 34 endpoint tests
4. ✅ Generate coverage report
5. ✅ Cleanup

**Total time:** ~2-3 minutes

---

## 📊 What Gets Tested

### All 34 Lambda Endpoints
```
Auth (5)
├── Login ✅
├── Register ✅
├── Registration Link ✅
├── Forgot Password ✅
└── Reset Password ✅

Users (4)
├── Get Profile ✅
├── Update Profile ✅
├── Get Class ✅
└── List Users ✅

Comments (5)
├── Create ✅
├── Get Published ✅
├── Get Pending ✅
├── Update/Publish ✅
└── Delete ✅

Admin (4)
├── Get Users ✅
├── Delete User ✅
├── Get Class Users ✅
└── Toggle Class Admin ✅

Schools (3)
├── List ✅
├── Get By ID ✅
└── Create ✅

Classes (4)
├── List By School ✅
├── Get By ID ✅
├── Create ✅
└── Get Members ✅

Events (5)
├── List By Class ✅
├── Get By ID ✅
├── Create ✅
├── Update ✅
└── Delete ✅

Photos (3)
├── Upload (Presigned URL) ✅
├── Delete ✅
└── Get Presigned URL ✅
```

---

## 🔧 Testing Methods

### Method 1: Local Automated Tests
```bash
# Simple test run
npm run test:lambda

# With verbose output
npm run test:lambda:verbose

# Keep SAM server running for manual testing
npm run sam:build
npm run sam:local
# In another terminal:
curl -X POST http://localhost:3001/api/auth/login ...
```

### Method 2: Manual curl Testing
```bash
# Start API server
npm run sam:local

# In another terminal, test an endpoint
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"testadmin@example.com","password":"admin123"}'
```

### Method 3: GitHub Actions (CI/CD)
Tests run automatically on every push and pull request:
- Triggered on: `main`, `develop` branches
- Runs on: Ubuntu latest
- Reports: Results as PR comment
- Artifacts: Uploaded test results

Check `.github/workflows/test-lambda.yml` for details.

---

## 📈 Test Results

### Output Format
```
========================================
   LAMBDA ENDPOINT TEST SUITE
========================================

1️⃣  AUTH ENDPOINTS (5 tests)

✅ POST /api/auth/login (200)
✅ POST /api/auth/register (201)
✅ GET /api/auth/registration-link/{hash} (200)
✅ POST /api/auth/forgot-password (200)
...

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

## 🐛 Debugging Failed Tests

### If a test fails:

1. **Check the error message**
   ```
   ❌ POST /api/auth/login (Got 500, expected 200)
      Error: Invalid credentials.
   ```

2. **Check the database**
   ```bash
   docker exec classyear-postgres psql -U admin -d class_reunion -c "SELECT * FROM users;"
   ```

3. **Check SAM logs**
   ```bash
   # Run SAM with verbose output
   sam local start-api --debug
   ```

4. **Test manually with curl**
   ```bash
   curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"testadmin@example.com","password":"admin123"}' | jq
   ```

---

## 📝 Test Data

The test script automatically:
- Registers test users
- Creates schools and classes
- Creates events
- Tests comment workflows
- Validates authorization

### Pre-populated User
```
Email:    testadmin@example.com
Password: admin123
Role:     Super Admin
```

---

## 🔄 Continuous Integration

### GitHub Actions Workflow

The workflow in `.github/workflows/test-lambda.yml`:

**Triggers:**
- On push to `main` or `develop`
- On any pull request to `main` or `develop`
- Only if Lambda code changed

**Steps:**
1. Checkout code
2. Set up Node.js 18
3. Install SAM CLI
4. Install dependencies
5. Build Lambda functions
6. Run all endpoint tests
7. Upload results as artifact
8. Comment on PR with results

**View Results:**
1. Go to pull request
2. Look for comment: "## Lambda Test Results"
3. See passed/failed count
4. Click Actions tab for full logs

---

## 🚀 Advanced Testing

### Custom Test Coverage

Edit `test-lambda-endpoints.js` to:
- Add new test cases
- Modify expected status codes
- Add validation checks
- Test error scenarios

Example:
```javascript
await test(
  'POST /api/auth/login with invalid email',
  'POST',
  '/auth/login',
  { email: 'invalid@example.com', password: 'anything' },
  401,  // Expect 401 Unauthorized
  (b) => b.error  // Validate error message exists
);
```

### Integration Tests

The test script handles:
- ✅ Authentication flows (login → register → forgot password)
- ✅ Authorization checks (admin-only endpoints)
- ✅ Data relationships (users → classes → events)
- ✅ CRUD operations (create, read, update, delete)
- ✅ Error scenarios (invalid inputs, missing fields)

---

## 📊 Expected Coverage

| Metric | Target | Actual |
|--------|--------|--------|
| Endpoints | 34 | 34 |
| HTTP Methods | GET, POST, PUT, DELETE | ✅ All |
| Status Codes | 200, 201, 400, 404, 500 | ✅ Validated |
| Auth Checks | ✅ | ✅ Tested |
| Error Cases | ✅ | ✅ Tested |

---

## 🎯 Test Plan for Different Scenarios

### Scenario 1: Before Deploying
```bash
npm run test:lambda
# ✅ Ensures all endpoints work before AWS deploy
```

### Scenario 2: After Code Changes
```bash
# In PR:
git push origin feature/new-endpoint
# GitHub Actions automatically runs tests
# PR shows pass/fail results
```

### Scenario 3: Debugging Production Issues
```bash
# Clone production database locally
# Update .env with production DB credentials
# Run tests against production data
npm run test:lambda
```

### Scenario 4: Load Testing (Advanced)
```javascript
// Modify test-lambda-endpoints.js to run multiple requests
for (let i = 0; i < 100; i++) {
  await test(`Login attempt ${i}`, ...);
}
```

---

## 📋 Checklist Before Deployment

- [ ] `npm run test:lambda` passes locally
- [ ] All 34 endpoints show ✅
- [ ] GitHub Actions workflow passes
- [ ] No failed tests in PR comments
- [ ] Database tests validated
- [ ] Authorization tests passed
- [ ] Error handling tested

---

## 🔐 Security Testing

The test suite validates:
- ✅ Password hashing (bcrypt)
- ✅ JWT token generation
- ✅ Authorization checks (admin, class admin, owner)
- ✅ SQL injection prevention (parameterized queries)
- ✅ CORS headers
- ✅ Error message safety (no sensitive data leaked)

---

## 📞 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Port 3001 already in use" | Kill process: `lsof -i :3001 \| awk 'NR!=1' \| xargs kill -9` |
| "Database connection failed" | Restart: `docker-compose down -v && docker-compose up -d` |
| "SAM not found" | Install: `pip install aws-sam-cli` |
| "Tests timeout" | Increase timeout in script or check SAM logs |
| "Node modules missing" | Run: `cd backend && npm install` |

---

## 🎓 Learning Resources

- [SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Jest Testing](https://jestjs.io/)
- [API Gateway Testing](https://docs.aws.amazon.com/apigateway/latest/developerguide/test-invoke-api-gateway-api.html)

---

**Ready to test! 🚀**

Run: `npm run test:lambda`
