import express, { Express } from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

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
      bio: '',
      nickname_school: '',
      then_photo_url: '',
      now_photo_url: '',
      created_at: new Date(),
      updated_at: new Date()
    }
  ],
  passwordResetTokens: [] as any[],
  emailVerificationTokens: [] as any[]
};

jest.mock('../../db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    // SELECT user by email
    if (sql.includes('SELECT') && sql.includes('users') && sql.includes('WHERE email')) {
      const email = params?.[0];
      const user = mockDb.users.find(u => u.email === email);
      return { rows: user ? [user] : [] };
    }

    // SELECT user by id
    if (sql.includes('SELECT') && sql.includes('users') && sql.includes('WHERE id')) {
      const userId = parseInt(params?.[0]);
      const user = mockDb.users.find(u => u.id === userId);
      return { rows: user ? [user] : [] };
    }

    // INSERT user
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

    // UPDATE user password
    if (sql.includes('UPDATE users SET password')) {
      const userId = parseInt(params?.[1]);
      const user = mockDb.users.find(u => u.id === userId);
      if (user) {
        user.password = params?.[0];
        user.updated_at = new Date();
      }
      return { rows: [] };
    }

    // UPDATE user email_verified
    if (sql.includes('UPDATE users SET email_verified')) {
      const userId = parseInt(params?.[0]);
      const user = mockDb.users.find(u => u.id === userId);
      if (user) {
        user.email_verified = true;
        user.updated_at = new Date();
      }
      return { rows: [] };
    }

    // SELECT profile
    if (sql.includes('SELECT') && sql.includes('profiles') && sql.includes('WHERE user_id')) {
      const userId = parseInt(params?.[0]);
      const profile = mockDb.profiles.find(p => p.user_id === userId);
      return { rows: profile ? [profile] : [] };
    }

    // INSERT profile
    if (sql.includes('INSERT INTO profiles')) {
      const profile = {
        id: mockDb.profiles.length + 1,
        user_id: params?.[0],
        first_name: params?.[1],
        last_name: params?.[2],
        bio: '',
        nickname_school: '',
        then_photo_url: '',
        now_photo_url: '',
        created_at: new Date(),
        updated_at: new Date()
      };
      mockDb.profiles.push(profile);
      return { rows: [profile] };
    }

    // INSERT password reset token
    if (sql.includes('INSERT INTO password_reset_tokens')) {
      mockDb.passwordResetTokens.push({
        user_id: params?.[0],
        token_hash: params?.[1],
        expires_at: params?.[2]
      });
      return { rows: [] };
    }

    // SELECT password reset token (get most recent valid token)
    if (sql.includes('SELECT') && sql.includes('password_reset_tokens')) {
      // Return most recent valid token if any exist
      const validTokens = mockDb.passwordResetTokens.filter(t =>
        new Date(t.expires_at) > new Date()
      ).sort((a, b) => new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime());

      if (validTokens.length > 0) {
        return { rows: [validTokens[0]] };
      }
      return { rows: [] };
    }

    // INSERT email verification token
    if (sql.includes('INSERT INTO email_verification_tokens')) {
      mockDb.emailVerificationTokens.push({
        user_id: params?.[0],
        token_hash: params?.[1],
        expires_at: params?.[2],
        verified: false
      });
      return { rows: [] };
    }

    // SELECT email verification token
    if (sql.includes('SELECT') && sql.includes('email_verification_tokens')) {
      // Return most recent valid token if any exist
      const validTokens = mockDb.emailVerificationTokens.filter(t =>
        new Date(t.expires_at) > new Date() && !t.verified
      ).sort((a, b) => new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime());

      if (validTokens.length > 0) {
        return { rows: [validTokens[0]] };
      }
      return { rows: [] };
    }

    // UPDATE email verification token
    if (sql.includes('UPDATE email_verification_tokens SET verified')) {
      const tokenHash = params?.[0];
      const token = mockDb.emailVerificationTokens.find(t => t.token_hash === tokenHash);
      if (token) {
        token.verified = true;
      }
      return { rows: [] };
    }

    // DELETE password reset token
    if (sql.includes('DELETE FROM password_reset_tokens')) {
      const tokenHash = params?.[0];
      mockDb.passwordResetTokens = mockDb.passwordResetTokens.filter(t => t.token_hash !== tokenHash);
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
    // Reset mock data
    mockDb.passwordResetTokens = [];
    mockDb.emailVerificationTokens = [];
    mockDb.users = [
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
    ];
  });

  describe('POST /api/auth/login', () => {
    it('should login user with valid credentials', async () => {
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
        .send({ email: 'test@example.com' });

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
      expect(response.body.user.email).toBe('newuser@example.com');
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
        .send({ email: 'existing@example.com' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should not reveal if email exists', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

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

  describe('POST /api/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      // Create a valid token
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      mockDb.passwordResetTokens.push({
        user_id: 1,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        created_at: new Date().toISOString()
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token,
          password: 'newpassword123',
          confirmPassword: 'newpassword123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should reject reset with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid_token_12345',
          newPassword: 'newpassword123',
          confirmPassword: 'newpassword123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject reset with mismatched passwords', async () => {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      mockDb.passwordResetTokens.push({
        user_id: 1,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        created_at: new Date().toISOString()
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token,
          password: 'newpassword123',
          confirmPassword: 'different'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('match');
    });
  });

  describe('POST /api/auth/verify-email', () => {
    it('should verify email with valid token', async () => {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      mockDb.emailVerificationTokens.push({
        user_id: 1,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        verified: false
      });

      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should reject verify with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'invalid_token_12345' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject verify if token already used', async () => {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      mockDb.emailVerificationTokens.push({
        user_id: 1,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        verified: true
      });

      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout and clear cookie', async () => {
      const response = await request(app).post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });
  });
});
