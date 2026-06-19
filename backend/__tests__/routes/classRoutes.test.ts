import request from 'supertest';
import express from 'express';
import { classRoutes } from '../../src/routes/classRoutes';
import { query } from '../../src/db';

jest.mock('../../src/db');

const app = express();
app.use(express.json());
app.use('/api/classes', classRoutes);

describe('Class Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/classes', () => {
    it('should return an empty list of classes', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/classes');

      expect(res.status).toBe(200);
      expect(res.body.classes).toEqual([]);
    });

    it('should return a list of classes ordered by year desc', async () => {
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            year: 2024,
            school_id: 1,
            school_name: 'Central High',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 2,
            year: 2023,
            school_id: 1,
            school_name: 'Central High',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]
      });

      const res = await request(app).get('/api/classes');

      expect(res.status).toBe(200);
      expect(res.body.classes).toHaveLength(2);
      expect(res.body.classes[0].year).toBe(2024);
      expect(res.body.classes[1].year).toBe(2023);
    });

    it('should handle server errors', async () => {
      (query as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/classes');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal server error.');
    });
  });

  describe('GET /api/classes/:id', () => {
    it('should return 404 if class not found', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/classes/999');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Class not found.');
    });

    it('should return class data with school info', async () => {
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 1,
          year: 2024,
          school_id: 1,
          school_name: 'Central High',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]
      });

      const res = await request(app).get('/api/classes/1');

      expect(res.status).toBe(200);
      expect(res.body.class).toHaveProperty('id');
      expect(res.body.class).toHaveProperty('year');
      expect(res.body.class).toHaveProperty('school_name');
      expect(res.body.class.year).toBe(2024);
      expect(res.body.class.school_name).toBe('Central High');
    });

    it('should handle server errors', async () => {
      (query as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/classes/1');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal server error.');
    });
  });

  describe('POST /api/classes', () => {
    it('should return 400 if required fields are missing', async () => {
      const res = await request(app).post('/api/classes').send({
        school_id: 1
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('school_id and year are required.');
    });

    it('should return 400 if school does not exist', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const res = await request(app).post('/api/classes').send({
        school_id: 999,
        year: 2024
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('School not found.');
    });

    it('should successfully create a new class', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // School exists
        .mockResolvedValueOnce({
          rows: [{
            id: 5,
            school_id: 1,
            year: 2024,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]
        }); // Class created

      const res = await request(app).post('/api/classes').send({
        school_id: 1,
        year: 2024
      });

      expect(res.status).toBe(201);
      expect(res.body.class).toHaveProperty('id');
      expect(res.body.class).toHaveProperty('school_id');
      expect(res.body.class).toHaveProperty('year');
      expect(res.body.class.year).toBe(2024);
    });

    it('should handle server errors', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).post('/api/classes').send({
        school_id: 1,
        year: 2024
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal server error.');
    });
  });

  describe('GET /api/classes/:id/members', () => {
    it('should return an empty members list', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/classes/1/members');

      expect(res.status).toBe(200);
      expect(res.body.members).toEqual([]);
    });

    it('should return class members ordered by last name and first name', async () => {
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            email: 'john@example.com',
            first_name: 'John',
            last_name: 'Doe',
            nickname_school: 'Johnny'
          },
          {
            id: 2,
            email: 'jane@example.com',
            first_name: 'Jane',
            last_name: 'Doe',
            nickname_school: null
          }
        ]
      });

      const res = await request(app).get('/api/classes/1/members');

      expect(res.status).toBe(200);
      expect(res.body.members).toHaveLength(2);
      expect(res.body.members[0].first_name).toBe('John');
      expect(res.body.members[1].first_name).toBe('Jane');
    });

    it('should handle server errors', async () => {
      (query as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/classes/1/members');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal server error.');
    });
  });
});
