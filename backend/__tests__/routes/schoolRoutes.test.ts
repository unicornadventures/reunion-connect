import request from 'supertest';
import express from 'express';
import { schoolRoutes } from '../../src/routes/schoolRoutes';
import { query } from '../../src/db';

jest.mock('../../src/db');

const app = express();
app.use(express.json());
app.use('/api/schools', schoolRoutes);

describe('School Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/schools', () => {
    it('should return an empty list of schools', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/schools');

      expect(res.status).toBe(200);
      expect(res.body.schools).toEqual([]);
    });

    it('should return a list of schools ordered by name', async () => {
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: 'Central High',
            location: 'Downtown',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 2,
            name: 'Westside Academy',
            location: 'West End',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]
      });

      const res = await request(app).get('/api/schools');

      expect(res.status).toBe(200);
      expect(res.body.schools).toHaveLength(2);
      expect(res.body.schools[0].name).toBe('Central High');
      expect(res.body.schools[1].name).toBe('Westside Academy');
    });

    it('should handle server errors', async () => {
      (query as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/schools');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal server error.');
    });
  });

  describe('GET /api/schools/:id', () => {
    it('should return 404 if school not found', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/schools/999');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('School not found.');
    });

    it('should return school data', async () => {
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Central High',
          location: 'Downtown',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]
      });

      const res = await request(app).get('/api/schools/1');

      expect(res.status).toBe(200);
      expect(res.body.school).toHaveProperty('id');
      expect(res.body.school).toHaveProperty('name');
      expect(res.body.school.name).toBe('Central High');
      expect(res.body.school.location).toBe('Downtown');
    });

    it('should handle server errors', async () => {
      (query as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/schools/1');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal server error.');
    });
  });

  describe('POST /api/schools', () => {
    it('should return 400 if school name is missing', async () => {
      const res = await request(app).post('/api/schools').send({
        location: 'Downtown'
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('School name is required.');
    });

    it('should successfully create a school with name only', async () => {
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 5,
          name: 'New School',
          location: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]
      });

      const res = await request(app).post('/api/schools').send({
        name: 'New School'
      });

      expect(res.status).toBe(201);
      expect(res.body.school).toHaveProperty('id');
      expect(res.body.school).toHaveProperty('name');
      expect(res.body.school.name).toBe('New School');
      expect(res.body.school.location).toBeNull();
    });

    it('should successfully create a school with name and location', async () => {
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 5,
          name: 'Central High',
          location: 'Downtown',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]
      });

      const res = await request(app).post('/api/schools').send({
        name: 'Central High',
        location: 'Downtown'
      });

      expect(res.status).toBe(201);
      expect(res.body.school).toHaveProperty('id');
      expect(res.body.school.name).toBe('Central High');
      expect(res.body.school.location).toBe('Downtown');
    });

    it('should handle server errors', async () => {
      (query as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).post('/api/schools').send({
        name: 'New School',
        location: 'Downtown'
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal server error.');
    });
  });
});
