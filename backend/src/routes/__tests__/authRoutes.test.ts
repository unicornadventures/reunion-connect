import express, { Express } from 'express';
import request from 'supertest';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock database
const mockDb = {
  users: [
    {
      id: 1,
      email: 'existing@example.com',
      password: '$2a$10$mock_hashed_password',
      is_admin: false,
      is_class_admin: false,
      email_verified: true,
      created_at: new Date(),
      updated_at: new Date()
    }
  ],
  profiles: [
    {
      id: 1,
      user_id: 1,
      first_name: 'John',
      last_name: 'Doe',
      bio: 'Test bio',
      created_at: new Date(),
      updated_at: new Date()
    }
  ],
  tokens: {
    passwordReset: [] as any[],
    emailVerification: [] as any[]
  }
};

jest.mock('../../db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    // Mock implementations for different queries
    if (sql.includes('SELECT * FROM users WHERE email')) {
      const email = params?.[0];
      const user = mockDb.users.find(u => u.email === email);
      return { rows: user ? [user] : [] };
    }

    if (sql.includes('INSERT INTO users')) {
      const user = {
        id: mockDb.users.length + 1,
        email: params?.[0],
        password: params?.[1],
        is_admin: params?.[2] || false,
        is_class_admin: params?.[3] || false,
        email_verified: false,
        created_at: new Date(),
        updated_at: new Date()
      };
      mockDb.users.push(user);
      return { rows: [user] };
    }

    if (sql.includes('SELECT * FROM profiles WHERE user_id')) {
      const profile = mockDb.profiles.find(p => p.user_id === params?.[0]);
      return { rows: profile ? [profile] : [] };
    }

    if (sql.includes('INSERT INTO profiles')) {
      const profile = {
        id: mockDb.profiles.length + 1,
        user_id: params?.[0],
        first_name: params?.[1],
        last_name: params?.[2],
        created_at: new Date(),
        updated_at: new Date()
      };
      mockDb.profiles.push(profile);
      return { rows: [] };
    }

    if (sql.includes('INSERT INTO email_verification_tokens')) {
      mockDb.tokens.emailVerification.push({
        user_id: params?.[0],
        token_hash: params?.[1],
        expires_at: params?.[2],
        verified: false
      });
      return { rows: [] };
    }

    if (sql.includes('UPDATE users SET password')) {
      const user = mockDb.users.find(u => u.id === params?.[1]);
      if (user) {
        user.password = params?.[0];
      }
      return { rows: [] };
    }

    return { rows: [] };
  })
}));

jest.mock('../../services/emailService', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendVerificationEmail: jest.fn()
}));

import { authRoutes } from '../authRoutes';

describe('Auth Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should login user with valid credentials', async () => {
      // Create a test user with known password
      const testPassword = 'password123';
      const hashedPassword = await bcrypt.hash(testPassword, 10);

      mockDb.users[0].password = hashedPassword;
      mockDb.users[0].email = 'login@example.com';

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: testPassword
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('is_admin');
    });

    it('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'existing@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user with valid data', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          firstName: 'John',
          lastName: 'Doe',
          password: 'password123',
          confirmPassword: 'password123'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', 'newuser@example.com');
    });

    it('should reject registration with mismatched passwords', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          firstName: 'John',
          lastName: 'Doe',
          password: 'password123',
          confirmPassword: 'different'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('match');
    });

    it('should reject registration with short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          firstName: 'John',
          lastName: 'Doe',
          password: '123',
          confirmPassword: '123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('6 characters');
    });

    it('should reject registration with existing email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'existing@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          password: 'password123',
          confirmPassword: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already registered');
    });

    it('should reject registration with missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should accept forgot-password request with valid email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'existing@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should not reveal if email exists', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('If the email exists');
    });

    it('should reject with missing email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout and clear cookie', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });
});
