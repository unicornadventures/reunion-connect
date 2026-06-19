import request from 'supertest';
import express from 'express';
import { authRoutes } from '../../src/routes/authRoutes';
import { query } from '../../src/db';
import bcrypt from 'bcryptjs';

jest.mock('../../src/db');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should return 400 if email or password is missing', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'test@example.com'
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email and password are required.');
    });

    it('should return 401 if user not found', async () => {
      (query as jest.Mock).mockResolvedValue({ rows: [] });

      const res = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'password123'
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials.');
    });

    it('should return 401 if password is incorrect', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            email: 'test@example.com',
            password: await bcrypt.hash('password123', 10),
            is_admin: false
          }]
        })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'wrongpassword'
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials.');
    });

  });

  describe('GET /api/auth/me', () => {
    it('should return 401 if not authenticated', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
    });
  });
});
