import { Express, Request, Response, NextFunction } from 'express';

/**
 * Mock admin auth middleware for testing
 * Allows all requests through with a mock admin user attached
 */
export function mockAdminAuth() {
  jest.mock('../../middleware/adminAuth', () => ({
    requireAdmin: jest.fn((req: Request, res: Response, next: NextFunction) => {
      req.user = { id: 1, is_admin: true, is_class_admin: false };
      next();
    }),
    requireSuperAdmin: jest.fn((req: Request, res: Response, next: NextFunction) => {
      req.user = { id: 1, is_admin: true, is_class_admin: false };
      next();
    }),
    requireEventAdmin: jest.fn((req: Request, res: Response, next: NextFunction) => {
      req.user = { id: 1, is_admin: true, is_class_admin: false };
      next();
    })
  }));
}

/**
 * Apply auth middleware mocking to Express app in tests
 * This injects mock user into all requests
 */
export function applyMockAuth(app: Express) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.user = req.user || { id: 1, is_admin: true, is_class_admin: false };
    next();
  });
}

/**
 * Create a mock admin user object
 */
export function createMockAdminUser(overrides?: Partial<any>) {
  return {
    id: 1,
    email: 'admin@example.com',
    is_admin: true,
    is_class_admin: false,
    created_at: new Date(),
    ...overrides
  };
}

/**
 * Create a mock regular user object
 */
export function createMockUser(overrides?: Partial<any>) {
  return {
    id: 2,
    email: 'user@example.com',
    is_admin: false,
    is_class_admin: false,
    created_at: new Date(),
    ...overrides
  };
}

/**
 * Create a mock class admin user object
 */
export function createMockClassAdmin(overrides?: Partial<any>) {
  return {
    id: 3,
    email: 'classadmin@example.com',
    is_admin: false,
    is_class_admin: true,
    created_at: new Date(),
    ...overrides
  };
}
