# Backend Unit Tests

Comprehensive test suite for the ClassYear backend API built with Jest and Supertest.

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Generate coverage report
```bash
npm run test:coverage
```

## Test Structure

Tests are organized by module:

```
src/
├── __tests__/
│   └── setup.ts              # Global test setup/teardown
├── services/
│   └── __tests__/
│       └── tokenService.test.ts    # Token generation and verification
├── routes/
│   └── __tests__/
│       ├── authRoutes.test.ts      # Authentication endpoints
│       └── classRoutes.test.ts     # Class management endpoints
└── middleware/
    └── __tests__/
        └── auth.test.ts            # Authentication middleware
```

## Test Coverage

### Token Service Tests
- Token generation (format, length, expiry)
- Token verification (matching, invalid tokens)
- Hash verification
- Unique token generation

### Auth Routes Tests
- **POST /auth/login**
  - Valid credentials
  - Invalid password
  - Non-existent email
  - Missing fields

- **POST /auth/register**
  - Valid registration
  - Password mismatch
  - Short password
  - Duplicate email
  - Missing fields

- **POST /auth/forgot-password**
  - Valid email request
  - Security: doesn't reveal if email exists
  - Missing email

- **POST /auth/logout**
  - Cookie clearing
  - Success response

### Class Routes Tests
- **GET /classes** - List all classes
- **GET /classes/:id** - Get specific class
- **GET /classes/:id/members** - Get class members
- **GET /classes/:id/alumni-count** - Get class alumni count

## Mocking Strategy

Tests use Jest mocks for:
- Database (`src/db.ts`)
- Email service (`src/services/emailService.ts`)
- AWS S3 service
- Authentication middleware

This allows tests to run in isolation without requiring a real database or external services.

## Test Features

- ✅ Isolated test cases with beforeEach setup
- ✅ Comprehensive error scenarios
- ✅ Request/response validation
- ✅ Edge case coverage
- ✅ Security testing (e.g., password leak prevention)
- ✅ Database mock implementation
- ✅ Proper HTTP status code testing

## Adding New Tests

1. Create test file alongside the module: `__tests__/moduleName.test.ts`
2. Import the module to test
3. Mock external dependencies
4. Write test cases with descriptive names
5. Test both success and failure paths

Example:
```typescript
describe('Feature', () => {
  describe('POST /endpoint', () => {
    it('should return success on valid input', async () => {
      const response = await request(app)
        .post('/endpoint')
        .send({ data: 'value' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should return error on invalid input', async () => {
      const response = await request(app)
        .post('/endpoint')
        .send({ data: '' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
});
```

## Continuous Integration

These tests can be run in CI/CD pipelines:
```bash
npm test -- --ci --coverage --maxWorkers=2
```

## Coverage Goals

- Services: 90%+
- Routes: 85%+
- Middleware: 90%+
- Overall: 80%+

Run `npm run test:coverage` to see current coverage.

## Troubleshooting

### Tests timing out
- Increase `testTimeout` in `jest.config.js`
- Check for unresolved promises

### Mock not working
- Ensure mock is defined before importing the module
- Check mock path matches the import path
- Clear mocks with `jest.clearAllMocks()`

### Type errors
- Run `npm run build` to check TypeScript compilation
- Ensure all types are imported correctly in test files
