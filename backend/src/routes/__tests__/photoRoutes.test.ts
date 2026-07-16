import express, { Express } from 'express';
import request from 'supertest';

const mockDb = {
  users: [
    { id: 1, email: 'user1@example.com', is_admin: false, is_class_admin: false, created_at: new Date(), updated_at: new Date() },
    { id: 2, email: 'user2@example.com', is_admin: false, is_class_admin: false, created_at: new Date(), updated_at: new Date() },
    { id: 3, email: 'admin@example.com', is_admin: true, is_class_admin: false, created_at: new Date(), updated_at: new Date() },
    { id: 4, email: 'classadmin-same@example.com', is_admin: false, is_class_admin: true, created_at: new Date(), updated_at: new Date() },
    { id: 5, email: 'classadmin-other@example.com', is_admin: false, is_class_admin: true, created_at: new Date(), updated_at: new Date() }
  ],
  // user 1, 2, and 4 share class 100; user 5 is a class admin for an unrelated class (200)
  classUsers: [
    { user_id: 1, class_id: 100 },
    { user_id: 2, class_id: 100 },
    { user_id: 4, class_id: 100 },
    { user_id: 5, class_id: 200 }
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
    if (sql.includes('SELECT is_admin, is_class_admin FROM users WHERE id')) {
      const userId = Number(params?.[0]);
      const user = mockDb.users.find(u => u.id === userId);
      return { rows: user ? [{ is_admin: user.is_admin, is_class_admin: user.is_class_admin }] : [] };
    }

    if (sql.includes('class_user cu1') && sql.includes('class_user cu2')) {
      const [requesterId, targetId] = (params || []).map(Number);
      const requesterClasses = mockDb.classUsers.filter(cu => cu.user_id === requesterId).map(cu => cu.class_id);
      const targetClasses = mockDb.classUsers.filter(cu => cu.user_id === targetId).map(cu => cu.class_id);
      const sameClass = requesterClasses.some(c => targetClasses.includes(c));
      return { rows: sameClass ? [{ exists: 1 }] : [] };
    }

    if (sql.includes('SELECT id FROM users WHERE id')) {
      const userId = Number(params?.[0]);
      const user = mockDb.users.find(u => u.id === userId);
      return { rows: user ? [{ id: user.id }] : [] };
    }

    if (sql.includes('SELECT') && /(then|now)_photo_url FROM profiles WHERE user_id/.test(sql)) {
      const userId = Number(params?.[0]);
      const profile = mockDb.profiles.find(p => p.user_id === userId);
      if (!profile) return { rows: [] };
      const column = sql.includes('then_photo_url') ? 'then_photo_url' : 'now_photo_url';
      return { rows: [{ [column]: profile[column as 'then_photo_url' | 'now_photo_url'] }] };
    }

    if (sql.includes('UPDATE profiles SET') && sql.includes('= NULL')) {
      const userId = Number(params?.[0]);
      const profile = mockDb.profiles.find(p => p.user_id === userId);
      if (profile) {
        if (sql.includes('then_photo_url')) {
          profile.then_photo_url = null;
        } else if (sql.includes('now_photo_url')) {
          profile.now_photo_url = null;
        }
        profile.updated_at = new Date();
        return { rows: [{ ...profile }] };
      }
      return { rows: [] };
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
  }),
  deletePhotoFromS3: jest.fn(async (_photoUrl: string) => {})
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
        .post('/api/users/1/photo/then?requesterId=1')
        .attach('file', Buffer.from('fake image data'), 'test.jpg');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('profile');
    });

    it('should handle now photo upload', async () => {
      const response = await request(app)
        .post('/api/users/1/photo/now?requesterId=1')
        .attach('file', Buffer.from('fake image data'), 'test.jpg');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('profile');
    });

    it('should reject upload for non-existent user', async () => {
      const response = await request(app)
        .post('/api/users/999/photo/then?requesterId=999')
        .attach('file', Buffer.from('fake image data'), 'test.jpg');

      expect(response.status).toBe(404);
    });

    it('should reject invalid photoType', async () => {
      const response = await request(app)
        .post('/api/users/1/photo/invalid?requesterId=1')
        .attach('file', Buffer.from('fake image data'), 'test.jpg');

      expect(response.status).toBe(400);
    });

    it('should reject without file', async () => {
      const response = await request(app)
        .post('/api/users/1/photo/then?requesterId=1')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should reject without requesterId', async () => {
      const response = await request(app)
        .post('/api/users/1/photo/then')
        .attach('file', Buffer.from('fake image data'), 'test.jpg');

      expect(response.status).toBe(400);
    });

    it('should reject a classmate with no admin role', async () => {
      // user 2 is a regular classmate of user 1, not an admin or class admin
      const response = await request(app)
        .post('/api/users/1/photo/then?requesterId=2')
        .attach('file', Buffer.from('fake image data'), 'test.jpg');

      expect(response.status).toBe(403);
    });

    it('should allow a super admin to manage any user\'s photo', async () => {
      const response = await request(app)
        .post('/api/users/1/photo/then?requesterId=3')
        .attach('file', Buffer.from('fake image data'), 'test.jpg');

      expect(response.status).toBe(200);
    });

    it('should allow a class admin to manage a photo for someone in their class', async () => {
      // user 4 is a class admin sharing class 100 with user 1
      const response = await request(app)
        .post('/api/users/1/photo/then?requesterId=4')
        .attach('file', Buffer.from('fake image data'), 'test.jpg');

      expect(response.status).toBe(200);
    });

    it('should reject a class admin managing a photo for someone outside their class', async () => {
      // user 5 is a class admin for class 200, unrelated to user 1's class 100
      const response = await request(app)
        .post('/api/users/1/photo/then?requesterId=5')
        .attach('file', Buffer.from('fake image data'), 'test.jpg');

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/users/:userId/photo/upload/:photoType', () => {
    it('should generate presigned URL for then photo', async () => {
      const response = await request(app)
        .post('/api/users/1/photo/upload/then')
        .send({ fileName: 'my_photo.jpg', requesterId: 1 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('presignedUrl');
    });

    it('should generate presigned URL for now photo', async () => {
      const response = await request(app)
        .post('/api/users/1/photo/upload/now')
        .send({ fileName: 'my_photo.jpg', requesterId: 1 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('presignedUrl');
    });

    it('should reject without fileName', async () => {
      const response = await request(app)
        .post('/api/users/1/photo/upload/then')
        .send({ requesterId: 1 });

      expect(response.status).toBe(400);
    });

    it('should reject invalid photoType', async () => {
      const response = await request(app)
        .post('/api/users/1/photo/upload/invalid')
        .send({ fileName: 'my_photo.jpg', requesterId: 1 });

      expect(response.status).toBe(400);
    });

    it('should reject for non-existent user', async () => {
      const response = await request(app)
        .post('/api/users/999/photo/upload/then')
        .send({ fileName: 'my_photo.jpg', requesterId: 999 });

      expect(response.status).toBe(404);
    });

    it('should reject without requesterId', async () => {
      const response = await request(app)
        .post('/api/users/1/photo/upload/then')
        .send({ fileName: 'my_photo.jpg' });

      expect(response.status).toBe(400);
    });

    it('should reject a classmate with no admin role', async () => {
      const response = await request(app)
        .post('/api/users/1/photo/upload/then')
        .send({ fileName: 'my_photo.jpg', requesterId: 2 });

      expect(response.status).toBe(403);
    });

    it('should allow a class admin to manage a photo for someone in their class', async () => {
      const response = await request(app)
        .post('/api/users/1/photo/upload/then')
        .send({ fileName: 'my_photo.jpg', requesterId: 4 });

      expect(response.status).toBe(200);
    });

    it('should reject a class admin managing a photo for someone outside their class', async () => {
      const response = await request(app)
        .post('/api/users/1/photo/upload/then')
        .send({ fileName: 'my_photo.jpg', requesterId: 5 });

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/users/:userId/photo/:photoType', () => {
    it('should update then photo URL', async () => {
      const response = await request(app)
        .put('/api/users/1/photo/then')
        .send({ photoUrl: 'https://example.com/new_then.jpg', requesterId: 1 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('profile');
    });

    it('should update now photo URL', async () => {
      const response = await request(app)
        .put('/api/users/1/photo/now')
        .send({ photoUrl: 'https://example.com/new_now.jpg', requesterId: 1 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('profile');
    });

    it('should reject without photoUrl', async () => {
      const response = await request(app)
        .put('/api/users/1/photo/then')
        .send({ requesterId: 1 });

      expect(response.status).toBe(400);
    });

    it('should reject invalid photoType', async () => {
      const response = await request(app)
        .put('/api/users/1/photo/invalid')
        .send({ photoUrl: 'https://example.com/photo.jpg', requesterId: 1 });

      expect(response.status).toBe(400);
    });

    it('should handle profile not found', async () => {
      const response = await request(app)
        .put('/api/users/999/photo/then')
        .send({ photoUrl: 'https://example.com/photo.jpg', requesterId: 999 });

      expect(response.status).toBe(404);
    });

    it('should reject without requesterId', async () => {
      const response = await request(app)
        .put('/api/users/1/photo/then')
        .send({ photoUrl: 'https://example.com/photo.jpg' });

      expect(response.status).toBe(400);
    });

    it('should reject a classmate with no admin role', async () => {
      const response = await request(app)
        .put('/api/users/1/photo/then')
        .send({ photoUrl: 'https://example.com/photo.jpg', requesterId: 2 });

      expect(response.status).toBe(403);
    });

    it('should allow a class admin to manage a photo for someone in their class', async () => {
      const response = await request(app)
        .put('/api/users/1/photo/then')
        .send({ photoUrl: 'https://example.com/photo.jpg', requesterId: 4 });

      expect(response.status).toBe(200);
    });

    it('should reject a class admin managing a photo for someone outside their class', async () => {
      const response = await request(app)
        .put('/api/users/1/photo/then')
        .send({ photoUrl: 'https://example.com/photo.jpg', requesterId: 5 });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/users/:userId/photo/:photoType', () => {
    it('should delete the then photo', async () => {
      const response = await request(app)
        .delete('/api/users/1/photo/then?requesterId=1');

      expect(response.status).toBe(200);
      expect(response.body.profile.then_photo_url).toBeNull();
    });

    it('should delete the now photo', async () => {
      const response = await request(app)
        .delete('/api/users/1/photo/now?requesterId=1');

      expect(response.status).toBe(200);
      expect(response.body.profile.now_photo_url).toBeNull();
    });

    it('should succeed even when there is no photo to delete', async () => {
      const response = await request(app)
        .delete('/api/users/2/photo/then?requesterId=2');

      expect(response.status).toBe(200);
      expect(response.body.profile.then_photo_url).toBeNull();
    });

    it('should reject invalid photoType', async () => {
      const response = await request(app)
        .delete('/api/users/1/photo/invalid?requesterId=1');

      expect(response.status).toBe(400);
    });

    it('should reject without requesterId', async () => {
      const response = await request(app)
        .delete('/api/users/1/photo/then');

      expect(response.status).toBe(400);
    });

    it('should handle profile not found', async () => {
      const response = await request(app)
        .delete('/api/users/999/photo/then?requesterId=999');

      expect(response.status).toBe(404);
    });

    it('should reject a classmate with no admin role', async () => {
      const response = await request(app)
        .delete('/api/users/1/photo/then?requesterId=2');

      expect(response.status).toBe(403);
    });

    it('should allow a super admin to delete any user\'s photo', async () => {
      const response = await request(app)
        .delete('/api/users/1/photo/then?requesterId=3');

      expect(response.status).toBe(200);
    });

    it('should allow a class admin to delete a photo for someone in their class', async () => {
      const response = await request(app)
        .delete('/api/users/1/photo/then?requesterId=4');

      expect(response.status).toBe(200);
    });

    it('should reject a class admin deleting a photo for someone outside their class', async () => {
      const response = await request(app)
        .delete('/api/users/1/photo/then?requesterId=5');

      expect(response.status).toBe(403);
    });
  });

  describe('Error Handling', () => {
    it('should handle database error in photo upload', async () => {
      const { query } = require('../../db');
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .post('/api/users/1/photo/then?requesterId=1')
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
        .send({ fileName: 'test.jpg', requesterId: 1 });

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
        .send({ photoUrl: 'https://example.com/photo.jpg', requesterId: 1 });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle S3 upload error', async () => {
      const s3Service = require('../../s3Service');
      s3Service.uploadFileToS3.mockImplementationOnce(async () => {
        throw new Error('Upload failed');
      });

      const response = await request(app)
        .post('/api/users/1/photo/then?requesterId=1')
        .attach('file', Buffer.from('fake image data'), 'test.jpg');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
});
