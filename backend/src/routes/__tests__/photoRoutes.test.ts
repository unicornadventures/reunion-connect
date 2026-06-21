import express, { Express } from 'express';
import request from 'supertest';

const mockDb = {
  users: [
    { id: 1, email: 'user1@example.com', created_at: new Date(), updated_at: new Date() },
    { id: 2, email: 'user2@example.com', created_at: new Date(), updated_at: new Date() }
  ],
  profiles: [
    {
      id: 1,
      user_id: 1,
      first_name: 'John',
      last_name: 'Doe',
      then_photo_url: 'https://example.com/john_then.jpg',
      now_photo_url: 'https://example.com/john_now.jpg',
      bio: '',
      nickname: '',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 2,
      user_id: 2,
      first_name: 'Jane',
      last_name: 'Smith',
      then_photo_url: null,
      now_photo_url: null,
      bio: '',
      nickname: '',
      created_at: new Date(),
      updated_at: new Date()
    }
  ]
};

jest.mock('../../db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    if (sql.includes('SELECT id FROM users WHERE id')) {
      const userId = Number(params?.[0]);
      const user = mockDb.users.find(u => u.id === userId);
      return { rows: user ? [{ id: user.id }] : [] };
    }

    if (sql.includes('UPDATE profiles SET')) {
      const photoUrl = params?.[0];
      const userId = Number(params?.[1]);
      const profile = mockDb.profiles.find(p => p.user_id === userId);
      if (profile) {
        if (sql.includes('then_photo_url')) {
          profile.then_photo_url = photoUrl;
        } else if (sql.includes('now_photo_url')) {
          profile.now_photo_url = photoUrl;
        }
        profile.updated_at = new Date();
        return { rows: [{ ...profile }] };
      }
      return { rows: [] };
    }

    return { rows: [] };
  })
}));

jest.mock('../../s3Service', () => ({
  uploadFileToS3: jest.fn(async (userId: number, fileName: string, buffer: Buffer) => {
    return `https://example.com/uploads/user${userId}/${fileName}`;
  }),
  generatePresignedUrl: jest.fn(async (userId: number, fileName: string) => {
    return `https://example.com/presigned/${userId}/${fileName}?token=abc123`;
  })
}));

jest.mock('../../services/emailService', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendVerificationEmail: jest.fn()
}));

jest.mock('multer', () => {
  const mockMulter = (options: any) => ({
    single: () => (req: any, res: any, next: any) => {
      // Only add file if the request has file data (mock for attach behavior)
      if (req.headers['content-type']?.includes('multipart/form-data')) {
        req.file = {
          originalname: 'test.jpg',
          buffer: Buffer.from('fake image data'),
          mimetype: 'image/jpeg',
          size: 1024
        };
      }
      next();
    }
  });
  mockMulter.memoryStorage = () => ({});
  return mockMulter;
});

import { photoRoutes } from '../photoRoutes';

describe('Photo Routes', () => {
  let app: Express;

  beforeEach(() => {
    mockDb.profiles = [
      {
        id: 1,
        user_id: 1,
        first_name: 'John',
        last_name: 'Doe',
        then_photo_url: 'https://example.com/john_then.jpg',
        now_photo_url: 'https://example.com/john_now.jpg',
        bio: '',
        nickname: '',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 2,
        user_id: 2,
        first_name: 'Jane',
        last_name: 'Smith',
        then_photo_url: null,
        now_photo_url: null,
        bio: '',
        nickname: '',
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/api/users', photoRoutes);
    jest.clearAllMocks();
  });

  describe('POST /api/users/:userId/photo/:photoType', () => {
    it('should handle then photo upload', async () => {
      const response = await request(app)
        .post('/api/users/1/photo/then')
        .attach('file', Buffer.from('fake image data'), 'test.jpg');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('profile');
    });

    it('should handle now photo upload', async () => {
      const response = await request(app)
        .post('/api/users/1/photo/now')
        .attach('file', Buffer.from('fake image data'), 'test.jpg');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('profile');
    });

    it('should reject upload for non-existent user', async () => {
      const response = await request(app)
        .post('/api/users/999/photo/then')
        .attach('file', Buffer.from('fake image data'), 'test.jpg');

      expect(response.status).toBe(404);
    });

    it('should reject invalid photoType', async () => {
      const response = await request(app)
        .post('/api/users/1/photo/invalid')
        .attach('file', Buffer.from('fake image data'), 'test.jpg');

      expect(response.status).toBe(400);
    });

    it('should reject without file', async () => {
      const response = await request(app)
        .post('/api/users/1/photo/then')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/users/:userId/photo/upload/:photoType', () => {
    it('should generate presigned URL for then photo', async () => {
      const response = await request(app)
        .post('/api/users/1/photo/upload/then')
        .send({ fileName: 'my_photo.jpg' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('presignedUrl');
    });

    it('should generate presigned URL for now photo', async () => {
      const response = await request(app)
        .post('/api/users/1/photo/upload/now')
        .send({ fileName: 'my_photo.jpg' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('presignedUrl');
    });

    it('should reject without fileName', async () => {
      const response = await request(app)
        .post('/api/users/1/photo/upload/then')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should reject invalid photoType', async () => {
      const response = await request(app)
        .post('/api/users/1/photo/upload/invalid')
        .send({ fileName: 'my_photo.jpg' });

      expect(response.status).toBe(400);
    });

    it('should reject for non-existent user', async () => {
      const response = await request(app)
        .post('/api/users/999/photo/upload/then')
        .send({ fileName: 'my_photo.jpg' });

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/users/:userId/photo/:photoType', () => {
    it('should update then photo URL', async () => {
      const response = await request(app)
        .put('/api/users/1/photo/then')
        .send({ photoUrl: 'https://example.com/new_then.jpg' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('profile');
    });

    it('should update now photo URL', async () => {
      const response = await request(app)
        .put('/api/users/1/photo/now')
        .send({ photoUrl: 'https://example.com/new_now.jpg' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('profile');
    });

    it('should reject without photoUrl', async () => {
      const response = await request(app)
        .put('/api/users/1/photo/then')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should reject invalid photoType', async () => {
      const response = await request(app)
        .put('/api/users/1/photo/invalid')
        .send({ photoUrl: 'https://example.com/photo.jpg' });

      expect(response.status).toBe(400);
    });

    it('should handle profile not found', async () => {
      const response = await request(app)
        .put('/api/users/999/photo/then')
        .send({ photoUrl: 'https://example.com/photo.jpg' });

      expect(response.status).toBe(404);
    });
  });

  describe('Error Handling', () => {
    it('should handle database error in photo upload', async () => {
      const { query } = require('../../db');
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .post('/api/users/1/photo/then')
        .attach('file', Buffer.from('fake image data'), 'test.jpg');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle S3 service error in presigned URL generation', async () => {
      const s3Service = require('../../s3Service');
      s3Service.generatePresignedUrl.mockImplementationOnce(async () => {
        throw new Error('S3 error');
      });

      const response = await request(app)
        .post('/api/users/1/photo/upload/then')
        .send({ fileName: 'test.jpg' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error in PUT photo', async () => {
      const { query } = require('../../db');
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .put('/api/users/1/photo/then')
        .send({ photoUrl: 'https://example.com/photo.jpg' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle S3 upload error', async () => {
      const s3Service = require('../../s3Service');
      s3Service.uploadFileToS3.mockImplementationOnce(async () => {
        throw new Error('Upload failed');
      });

      const response = await request(app)
        .post('/api/users/1/photo/then')
        .attach('file', Buffer.from('fake image data'), 'test.jpg');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
});
