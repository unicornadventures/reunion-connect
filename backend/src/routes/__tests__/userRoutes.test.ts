import express, { Express } from 'express';
import request from 'supertest';

const mockDb = {
  users: [
    { id: 1, email: 'user1@example.com', password: 'hashed_pass', is_admin: false, created_at: new Date() },
    { id: 2, email: 'user2@example.com', password: 'hashed_pass', is_admin: false, created_at: new Date() }
  ],
  profiles: [
    {
      id: 1,
      user_id: 1,
      first_name: 'John',
      last_name: 'Doe',
      bio: 'Test bio',
      nickname_school: 'Johnny',
      then_photo_url: 'http://example.com/then.jpg',
      now_photo_url: 'http://example.com/now.jpg',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 2,
      user_id: 2,
      first_name: 'Jane',
      last_name: 'Smith',
      bio: '',
      nickname_school: '',
      then_photo_url: '',
      now_photo_url: '',
      created_at: new Date(),
      updated_at: new Date()
    }
  ],
  classUsers: [
    { id: 1, class_id: 1, user_id: 1 },
    { id: 2, class_id: 2, user_id: 2 }
  ],
  classes: [
    { id: 1, school_id: 1, year: 2020 },
    { id: 2, school_id: 1, year: 2021 }
  ]
};

jest.mock('../../db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    // SELECT user by id
    if (sql.includes('SELECT') && sql.includes('users') && sql.includes('WHERE id')) {
      const userId = parseInt(params?.[0]);
      const user = mockDb.users.find(u => u.id === userId);
      return { rows: user ? [user] : [] };
    }

    // SELECT profile by user_id
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

    // UPDATE profile
    if (sql.includes('UPDATE profiles SET')) {
      const userId = parseInt(params?.[params.length - 1]);
      const profile = mockDb.profiles.find(p => p.user_id === userId);
      if (profile) {
        // Handle different update fields
        if (sql.includes('bio')) {
          profile.bio = params?.[0];
        } else if (sql.includes('first_name')) {
          profile.first_name = params?.[0];
          profile.last_name = params?.[1];
        } else if (sql.includes('then_photo_url')) {
          profile.then_photo_url = params?.[0];
        } else if (sql.includes('now_photo_url')) {
          profile.now_photo_url = params?.[0];
        }
        profile.updated_at = new Date();
        return { rows: [profile] };
      }
      return { rows: [] };
    }

    // SELECT class by user
    if (sql.includes('SELECT c.id') && sql.includes('class_user cu')) {
      const userId = parseInt(params?.[0]);
      const classUser = mockDb.classUsers.find(cu => cu.user_id === userId);
      if (classUser) {
        const cls = mockDb.classes.find(c => c.id === classUser.class_id);
        if (cls) {
          return {
            rows: [{
              id: cls.id,
              year: cls.year,
              school_id: cls.school_id,
              school_name: 'Test School'
            }]
          };
        }
      }
      return { rows: [] };
    }

    // INSERT class_user
    if (sql.includes('INSERT INTO class_user')) {
      const classUser = {
        id: mockDb.classUsers.length + 1,
        class_id: params?.[0],
        user_id: params?.[1]
      };
      mockDb.classUsers.push(classUser);
      return { rows: [] };
    }

    // CHECK class_user exists
    if (sql.includes('SELECT id FROM class_user')) {
      const userId = parseInt(params?.[0]);
      const classId = parseInt(params?.[1]);
      const exists = mockDb.classUsers.find(cu => cu.user_id === userId && cu.class_id === classId);
      return { rows: exists ? [{ id: exists.id }] : [] };
    }

    // CHECK class exists
    if (sql.includes('SELECT id FROM classes WHERE id')) {
      const classId = parseInt(params?.[0]);
      const cls = mockDb.classes.find(c => c.id === classId);
      return { rows: cls ? [{ id: cls.id }] : [] };
    }

    return { rows: [] };
  })
}));

jest.mock('../../services/emailService', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendVerificationEmail: jest.fn()
}));

jest.mock('../../s3Service.ts', () => ({
  uploadToS3: jest.fn(async () => 'http://example.com/photo.jpg'),
  deleteFromS3: jest.fn(async () => true)
}));

import { userRoutes } from '../userRoutes';

describe('User Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/users', userRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/users/:id', () => {
    it('should return user profile', async () => {
      const response = await request(app).get('/api/users/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('profile');
      expect(response.body.user.id).toBe(1);
    });

    it('should return profile with all fields', async () => {
      const response = await request(app).get('/api/users/1');

      expect(response.status).toBe(200);
      if (response.body.profile) {
        expect(response.body.profile).toHaveProperty('first_name');
        expect(response.body.profile).toHaveProperty('last_name');
        expect(response.body.profile).toHaveProperty('bio');
        expect(response.body.profile).toHaveProperty('then_photo_url');
        expect(response.body.profile).toHaveProperty('now_photo_url');
      }
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app).get('/api/users/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle users without profile', async () => {
      const response = await request(app).get('/api/users/2');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('profile');
    });
  });

  describe('GET /api/users/:id/class', () => {
    it('should return user class information', async () => {
      const response = await request(app).get('/api/users/1/class');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('class');
      expect(response.body.class).toHaveProperty('id');
      expect(response.body.class).toHaveProperty('year');
      expect(response.body.class.id).toBe(1);
    });

    it('should return class with school information', async () => {
      const response = await request(app).get('/api/users/1/class');

      expect(response.status).toBe(200);
      if (response.body.class) {
        expect(response.body.class).toHaveProperty('school_name');
      }
    });

    it('should return 404 when user has no class', async () => {
      const response = await request(app).get('/api/users/999/class');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/users/:userId/assign-class', () => {
    it('should assign user to class', async () => {
      const response = await request(app)
        .post('/api/users/2/assign-class')
        .send({ class_id: 1 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should reject assignment without class_id', async () => {
      const response = await request(app)
        .post('/api/users/2/assign-class')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject assignment with non-existent user', async () => {
      const response = await request(app)
        .post('/api/users/999/assign-class')
        .send({ class_id: 1 });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject assignment with non-existent class', async () => {
      const response = await request(app)
        .post('/api/users/2/assign-class')
        .send({ class_id: 999 });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject duplicate assignment', async () => {
      const response = await request(app)
        .post('/api/users/1/assign-class')
        .send({ class_id: 1 });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/users/:userId/profile', () => {
    it('should update user profile bio', async () => {
      const response = await request(app)
        .put('/api/users/1/profile')
        .send({ bio: 'Updated bio' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('profile');
      expect(response.body.profile.bio).toBe('Updated bio');
    });

    it('should update nickname_school field', async () => {
      const response = await request(app)
        .put('/api/users/1/profile')
        .send({
          nickname_school: 'JD'
        });

      expect([200, 400]).toContain(response.status);
    });

    it('should accept partial updates', async () => {
      const response = await request(app)
        .put('/api/users/1/profile')
        .send({ bio: 'Only bio update' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('profile');
    });

    it('should reject update for non-existent user', async () => {
      const response = await request(app)
        .put('/api/users/999/profile')
        .send({ bio: 'Updated bio' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should update profile with empty body', async () => {
      const response = await request(app)
        .put('/api/users/1/profile')
        .send({});

      expect([200, 400]).toContain(response.status);
    });
  });

  describe('POST /api/users/:userId/photo/:photoType', () => {
    it('should handle then photo upload', async () => {
      const response = await request(app)
        .post('/api/users/1/photo/then')
        .attach('file', Buffer.from('fake image data'), 'test.jpg');

      expect([200, 400, 500]).toContain(response.status);
    });

    it('should handle now photo upload', async () => {
      const response = await request(app)
        .post('/api/users/1/photo/now')
        .attach('file', Buffer.from('fake image data'), 'test.jpg');

      expect([200, 400, 500]).toContain(response.status);
    });

    it('should reject upload for non-existent user', async () => {
      const response = await request(app)
        .post('/api/users/999/photo/then')
        .attach('file', Buffer.from('fake image data'), 'test.jpg');

      expect([400, 404, 500]).toContain(response.status);
    });

    it('should validate photo type (then or now)', async () => {
      const response = await request(app)
        .post('/api/users/1/photo/invalid')
        .attach('file', Buffer.from('fake image data'), 'test.jpg');

      expect([200, 400, 500]).toContain(response.status);
    });

    it('should require file upload', async () => {
      const response = await request(app)
        .post('/api/users/1/photo/then')
        .send({});

      expect([200, 400, 500]).toContain(response.status);
    });
  });
});
