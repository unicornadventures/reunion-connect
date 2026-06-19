import request from 'supertest';
import express from 'express';
import { userRoutes } from '../../src/routes/userRoutes';
import { query } from '../../src/db';
import bcrypt from 'bcryptjs';

jest.mock('../../src/db');

const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);

describe('User Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/users/register', () => {
    it('should return 400 if required fields are missing', async () => {
      const res = await request(app).post('/api/users/register').send({
        email: 'test@example.com',
        first_name: 'John'
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing required fields.');
    });

    it('should return 400 if class_id does not exist', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce({}) // BEGIN transaction
        .mockResolvedValueOnce({ rows: [] }); // Class check returns empty

      const res = await request(app).post('/api/users/register').send({
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        password: 'password123',
        class_id: 999
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Provided class_id does not exist.');
    });

    it('should return 409 if user already exists (duplicate email)', async () => {
      const duplicateError = new Error('duplicate key value violates unique constraint');
      (duplicateError as any).code = '23505';

      (query as jest.Mock).mockImplementation((text) => {
        if (text === 'BEGIN') {
          return Promise.resolve({});
        }
        if (text.includes('SELECT id FROM classes')) {
          return Promise.resolve({ rows: [{ id: 1 }] });
        }
        if (text.includes('INSERT INTO users')) {
          return Promise.reject(duplicateError);
        }
        return Promise.resolve({});
      });

      const res = await request(app).post('/api/users/register').send({
        email: 'existing@example.com',
        first_name: 'John',
        last_name: 'Doe',
        password: 'password123',
        class_id: 1
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('User already exists.');
    });

    it('should successfully register a new user', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce({}) // BEGIN transaction
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Class exists
        .mockResolvedValueOnce({
          rows: [{
            id: 5,
            email: 'newuser@example.com',
            is_admin: false,
            created_at: new Date().toISOString()
          }]
        }) // User insert
        .mockResolvedValueOnce({}) // Profile insert
        .mockResolvedValueOnce({}) // Class user link
        .mockResolvedValueOnce({}); // COMMIT transaction

      const res = await request(app).post('/api/users/register').send({
        email: 'newuser@example.com',
        first_name: 'John',
        last_name: 'Doe',
        password: 'password123',
        class_id: 1
      });

      expect(res.status).toBe(201);
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user).toHaveProperty('email');
      expect(res.body.user).toHaveProperty('is_admin');
      expect(res.body.user).toHaveProperty('created_at');
      expect(res.body.user.email).toBe('newuser@example.com');
      expect(res.body.user.is_admin).toBe(false);
    });

    it('should handle server errors and rollback transaction', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce({}) // BEGIN transaction
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Class exists
        .mockRejectedValueOnce(new Error('Database error')) // Error during query
        .mockResolvedValueOnce({}); // ROLLBACK transaction

      const res = await request(app).post('/api/users/register').send({
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        password: 'password123',
        class_id: 1
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal server error during registration.');
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return 404 if user not found', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/users/999');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User not found.');
    });

    it('should return user data with profile', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            email: 'test@example.com',
            is_admin: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            user_id: 1,
            first_name: 'John',
            last_name: 'Doe',
            nickname_school: 'Johnny'
          }]
        });

      const res = await request(app).get('/api/users/1');

      expect(res.status).toBe(200);
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user).toHaveProperty('email');
      expect(res.body.profile).toHaveProperty('first_name');
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body.profile.first_name).toBe('John');
    });

    it('should return user data with null profile if profile does not exist', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            email: 'test@example.com',
            is_admin: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]
        })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/users/1');

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body.profile).toBeNull();
    });

    it('should handle server errors', async () => {
      (query as jest.Mock).mockRejectedValue(new Error('Database error'));

      const res = await request(app).get('/api/users/1');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal server error.');
    });
  });
});
