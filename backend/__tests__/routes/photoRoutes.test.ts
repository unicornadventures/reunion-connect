import request from 'supertest';
import express from 'express';
import { photoRoutes } from '../../src/routes/photoRoutes';
import { query } from '../../src/db';
import * as s3Service from '../../src/s3Service';

jest.mock('../../src/db');
jest.mock('../../src/s3Service');

const app = express();
app.use(express.json());
app.use('/api/photos', photoRoutes);

describe('Photo Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/photos/:userId/photo/upload/:photoType', () => {
    it('should return 400 if required parameters are missing', async () => {
      const res = await request(app).post('/api/photos/1/photo/upload/then').send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing required parameters.');
    });

    it('should return 400 if photoType is invalid', async () => {
      const res = await request(app).post('/api/photos/1/photo/upload/invalid').send({
        fileName: 'photo.jpg'
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('photoType must be "then" or "now".');
    });

    it('should return 404 if user does not exist', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const res = await request(app).post('/api/photos/999/photo/upload/then').send({
        fileName: 'photo.jpg'
      });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User not found.');
    });

    it('should successfully generate presigned URL for "then" photo', async () => {
      const mockPresignedUrl = 'https://s3.example.com/presigned-url';

      (query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 1 }] });
      (s3Service.generatePresignedUrl as jest.Mock).mockResolvedValueOnce(mockPresignedUrl);

      const res = await request(app).post('/api/photos/1/photo/upload/then').send({
        fileName: 'photo.jpg'
      });

      expect(res.status).toBe(200);
      expect(res.body.presignedUrl).toBe(mockPresignedUrl);
      expect(s3Service.generatePresignedUrl).toHaveBeenCalledWith(1, 'photo.jpg');
    });

    it('should successfully generate presigned URL for "now" photo', async () => {
      const mockPresignedUrl = 'https://s3.example.com/presigned-url-now';

      (query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 2 }] });
      (s3Service.generatePresignedUrl as jest.Mock).mockResolvedValueOnce(mockPresignedUrl);

      const res = await request(app).post('/api/photos/2/photo/upload/now').send({
        fileName: 'photo-now.jpg'
      });

      expect(res.status).toBe(200);
      expect(res.body.presignedUrl).toBe(mockPresignedUrl);
      expect(s3Service.generatePresignedUrl).toHaveBeenCalledWith(2, 'photo-now.jpg');
    });

    it('should handle S3 service errors', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 1 }] });
      (s3Service.generatePresignedUrl as jest.Mock).mockRejectedValueOnce(
        new Error('S3 error')
      );

      const res = await request(app).post('/api/photos/1/photo/upload/then').send({
        fileName: 'photo.jpg'
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Could not generate secure upload URL.');
    });
  });

  describe('PUT /api/photos/:userId/photo/:photoType', () => {
    it('should return 400 if required parameters are missing', async () => {
      const res = await request(app).put('/api/photos/1/photo/then').send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing required parameters.');
    });

    it('should return 400 if photoType is invalid', async () => {
      const res = await request(app).put('/api/photos/1/photo/invalid').send({
        photoUrl: 'https://example.com/photo.jpg'
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('photoType must be "then" or "now".');
    });

    it('should return 404 if profile not found', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const res = await request(app).put('/api/photos/999/photo/then').send({
        photoUrl: 'https://example.com/photo.jpg'
      });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Profile not found.');
    });

    it('should successfully update "then" photo URL', async () => {
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          user_id: 1,
          then_photo_url: 'https://example.com/photo.jpg',
          updated_at: new Date().toISOString()
        }]
      });

      const res = await request(app).put('/api/photos/1/photo/then').send({
        photoUrl: 'https://example.com/photo.jpg'
      });

      expect(res.status).toBe(200);
      expect(res.body.profile).toHaveProperty('then_photo_url');
      expect(res.body.profile.then_photo_url).toBe('https://example.com/photo.jpg');
    });

    it('should successfully update "now" photo URL', async () => {
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          user_id: 1,
          now_photo_url: 'https://example.com/photo-now.jpg',
          updated_at: new Date().toISOString()
        }]
      });

      const res = await request(app).put('/api/photos/1/photo/now').send({
        photoUrl: 'https://example.com/photo-now.jpg'
      });

      expect(res.status).toBe(200);
      expect(res.body.profile).toHaveProperty('now_photo_url');
      expect(res.body.profile.now_photo_url).toBe('https://example.com/photo-now.jpg');
    });

    it('should handle server errors', async () => {
      (query as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).put('/api/photos/1/photo/then').send({
        photoUrl: 'https://example.com/photo.jpg'
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Could not update photo URL.');
    });
  });
});
