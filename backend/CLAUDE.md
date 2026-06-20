# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ClassYear** is a class reunion backend API built with Node.js, Express, TypeScript, and PostgreSQL. It handles user authentication, class/reunion management, messaging, photos, and admin operations.

**Tech Stack:**
- Runtime: Node.js with ES modules
- Framework: Express.js
- Language: TypeScript (ES2020 target)
- Database: PostgreSQL with pg driver
- Testing: Jest with ts-jest
- Auth: JWT tokens + bcryptjs password hashing
- AWS: S3 for photo storage, SES for emails

## Common Commands

```bash
# Development
npm run dev              # Run dev server with ts-node

# Build & Type checking
npm run build           # Compile TypeScript to dist/

# Testing
npm test                # Run all tests (338 tests)
npm run test:watch      # Watch mode for tests
npm run test:coverage   # Generate coverage report (95.1% overall)

# Testing specific suites
npm test -- src/routes/__tests__/userRoutes.test.ts  # Single route
npm test -- --testNamePattern="GET /api/users"       # By test name
```

## Architecture

### Directory Structure

```
src/
├── routes/              # API route handlers
│   ├── adminRoutes.ts, userRoutes.ts, authRoutes.ts, etc.
│   └── __tests__/       # Route tests with mocks
├── services/            # Business logic (tokenService, emailService)
├── utils/               # Utilities (auth middleware, password hashing)
├── db.ts               # PostgreSQL connection pool & query function
├── schema.ts           # Database initialization
├── seed.ts             # Admin user seeding
└── types.ts            # TypeScript interfaces
```

### Route Structure Pattern

All 11 routes follow a consistent pattern:
- **POST** endpoints include parameter validation before database operations
- **GET** endpoints handle filtering, pagination, error cases
- **DELETE** endpoints check existence first
- Error handling: try-catch with 500 responses for unexpected errors, 400/404 for client errors

### Test Architecture

**Mock Database Pattern:** Routes are tested with a mock database (not real PostgreSQL). Each test file:
1. Defines a `mockDb` object with sample data (users, profiles, classes, etc.)
2. Uses `jest.mock('../../db')` to intercept queries
3. Implements SQL pattern matching to handle different query types
4. Manually updates mockDb state to simulate database behavior

**Example patterns:**
```typescript
// Query selection by pattern
if (sql.includes('SELECT') && sql.includes('WHERE id')) {
  // Handle specific query type
}

// Data manipulation
mockDb.users.push(newUser);  // Simulate INSERT
mockDb.users = mockDb.users.filter(...);  // Simulate DELETE
```

**Coverage:** 338 tests across 19 test suites with 99.4% average route coverage (all 11 routes at 98%+).

### Database Transactions

Critical operations use transaction control:
```typescript
await query('BEGIN');
try {
  // Multiple operations
  await query('COMMIT');
} catch {
  await query('ROLLBACK');
}
```

Tests mock these with simple resolution: `if (sql === 'BEGIN') return { rows: [] };`

## Testing Notes

### Key Test Patterns

1. **Mock Database Setup** - Define mockDb object at top of test file with sample data
2. **Query Interception** - Use sql.includes() to pattern-match queries instead of exact matching
3. **Parameter Validation Tests** - Test missing fields, invalid inputs, non-existent IDs
4. **Error Handling Tests** - Mock query to throw errors to test catch blocks
5. **Edge Cases** - Test token expiration, duplicate emails, cross-class access denial

### Coverage Insights

- **100% Routes** (7): adminRoutes, classRoutes, commentRoutes, eventRoutes, adminEventRoutes, adminSchoolRoutes, schoolRoutes
- **98%+ Routes** (4): authRoutes (99.67%), userRoutes (98.2%), photoRoutes (98.18%), adminClassRoutes (98.7%)
- **Excluded from coverage** (intentional): db.ts (ES module import.meta prevents direct testing), types.ts (TypeScript interfaces generate no runtime code), server.ts, middleware/
- **Known uncovered edge cases** (~8 lines total): Rare error scenarios, defensive middleware checks

### Adding New Tests

Follow these steps:
1. Create mock database in test file with relevant entities
2. Set up jest.mock for db module with query interceptor
3. Mock external services (emailService, seedAdminUser, etc.)
4. Test success path, parameter validation, error handling, edge cases
5. Run `npm test -- --coverage` to verify coverage > 98%

## Important Implementation Details

### Authentication Flow

- `authenticateToken` middleware in `src/utils/auth.ts` validates JWT from cookies or Authorization header
- Routes using middleware: GET /me (requires auth), admin routes (require admin flag)
- JWT payload includes: id, email, is_admin, profile data

### Email & Password Reset

- `generateResetToken()` creates crypto-random token + SHA256 hash
- `verifyResetToken()` compares hashes (token hash stored in DB, plaintext sent via email)
- Tokens expire in 1 hour, single-use with verification flag

### Mock Service Pattern

All external services (emailService, S3, etc.) are mocked in tests:
```typescript
jest.mock('../../services/emailService', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendVerificationEmail: jest.fn()
}));
```

## Code Quality Standards

- **Coverage Target:** 98%+ for all route modules (currently achieved)
- **Type Safety:** TypeScript with `"strict": false` in tsconfig.json
  - Allows implicit `any` types (parameters without explicit type annotations)
  - Allows looser null/undefined handling
  - This is intentional for development velocity; not a limitation to work around
  - If stricter typing is needed in the future, enable `"strict": true` and add type annotations incrementally
- **Error Handling:** Consistent try-catch with appropriate HTTP status codes
- **Parameter Normalization:** email.toLowerCase().trim() before DB operations
- **Database Queries:** Parameterized queries with $1, $2, etc. for SQL injection prevention
