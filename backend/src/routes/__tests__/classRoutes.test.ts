import express, { Express } from 'express';
import request from 'supertest';

const mockDb = {
  classes: [
    { id: 1, year: 2020, created_at: new Date() },
    { id: 2, year: 2021, created_at: new Date() }
  ],
  classSchool: [
    { class_id: 1, school_id: 1 },
    { class_id: 2, school_id: 1 }
  ],
  schools: [
    { id: 1, name: 'Lincoln High', location: 'Lincoln, NE' }
  ],
  users: [
    { id: 1, email: 'user1@example.com', created_at: new Date() },
    { id: 2, email: 'user2@example.com', created_at: new Date() },
    { id: 3, email: 'user3@example.com', created_at: new Date() }
  ],
  profiles: [
    { id: 1, user_id: 1, first_name: 'John', last_name: 'Doe', nickname: '', now_photo_url: null, then_photo_url: null },
    { id: 2, user_id: 2, first_name: 'Jane', last_name: 'Smith', nickname: '', now_photo_url: null, then_photo_url: null },
    { id: 3, user_id: 3, first_name: 'Bob', last_name: 'Johnson', nickname: 'Bobby', now_photo_url: 'https://example.com/bob_now.jpg', then_photo_url: 'https://example.com/bob_then.jpg' }
  ],
  classUsers: [
    { id: 1, class_id: 1, user_id: 1, school_id: 1 },
    { id: 2, class_id: 1, user_id: 2, school_id: 1 },
    { id: 3, class_id: 2, user_id: 3, school_id: 1 }
  ],
  comments: [
    { id: 1, target_user_id: 1, commenter_id: 2, content: 'Great to see you!', published: true, created_at: new Date() },
    { id: 2, target_user_id: 2, commenter_id: 1, content: 'How have you been?', published: true, created_at: new Date() }
  ]
};

jest.mock('../../db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    // GET all classes (SELECT id, year FROM classes)
    if (sql.includes('SELECT id, year FROM classes') && !sql.includes('WHERE')) {
      return { rows: mockDb.classes.map(c => ({ id: c.id, year: c.year })) };
    }

    // GET single class by id (with class_school JOIN)
    if (sql.includes('FROM classes c') && sql.includes('LEFT JOIN class_school') && sql.includes('WHERE c.id')) {
      const classId = Number(params?.[0]);
      const cls = mockDb.classes.find(c => c.id === classId);
      if (!cls) return { rows: [] };
      const cs = mockDb.classSchool.find(cs => cs.class_id === classId);
      const school = cs ? mockDb.schools.find(s => s.id === cs.school_id) : null;
      return {
        rows: [{
          id: cls.id,
          year: cls.year,
          school_id: cs?.school_id || null,
          school_name: school?.name || null,
          created_at: cls.created_at
        }]
      };
    }

    // GET class members
    if (sql.includes('SELECT u.id, u.email, p.first_name, p.last_name, p.nickname') && sql.includes('class_user')) {
      const classId = Number(params?.[0]);
      const members = mockDb.classUsers
        .filter(cu => cu.class_id === classId)
        .map(cu => {
          const user = mockDb.users.find(u => u.id === cu.user_id);
          const profile = mockDb.profiles.find(p => p.user_id === cu.user_id);
          return user && profile ? {
            id: user.id, email: user.email,
            first_name: profile.first_name, last_name: profile.last_name, nickname: profile.nickname
          } : null;
        })
        .filter(Boolean);
      return { rows: members };
    }

    // GET class directory — auth check
    if (sql.includes('SELECT class_id FROM class_user WHERE user_id') && sql.includes('AND class_id')) {
      const userId = Number(params?.[0]);
      const classId = Number(params?.[1]);
      const found = mockDb.classUsers.find(cu => cu.user_id === userId && cu.class_id === classId);
      return { rows: found ? [{ class_id: classId }] : [] };
    }

    // GET directory users
    if (sql.includes('now_photo_url') && sql.includes('class_user')) {
      const classId = Number(params?.[0]);
      const users = mockDb.classUsers
        .filter(cu => cu.class_id === classId)
        .map(cu => {
          const user = mockDb.users.find(u => u.id === cu.user_id);
          const profile = mockDb.profiles.find(p => p.user_id === cu.user_id);
          return user && profile ? {
            id: user.id, email: user.email,
            first_name: profile.first_name, last_name: profile.last_name, nickname: profile.nickname,
            now_photo_url: profile.now_photo_url, then_photo_url: profile.then_photo_url
          } : null;
        })
        .filter(Boolean);
      return { rows: users };
    }

    // COUNT alumni
    if (sql.includes('SELECT COUNT(*) as count FROM class_user WHERE class_id')) {
      const classId = Number(params?.[0]);
      const count = mockDb.classUsers.filter(cu => cu.class_id === classId).length;
      return { rows: [{ count }] };
    }

    // GET recently joined
    if (sql.includes('ORDER BY u.created_at DESC') && sql.includes('LIMIT 3')) {
      const classId = Number(params?.[0]);
      const users = mockDb.classUsers
        .filter(cu => cu.class_id === classId)
        .map(cu => {
          const user = mockDb.users.find(u => u.id === cu.user_id);
          const profile = mockDb.profiles.find(p => p.user_id === cu.user_id);
          return user && profile ? {
            id: user.id, email: user.email, created_at: user.created_at,
            first_name: profile.first_name, last_name: profile.last_name, nickname: profile.nickname,
            now_photo_url: profile.now_photo_url, then_photo_url: profile.then_photo_url
          } : null;
        })
        .filter(Boolean)
        .slice(0, 3);
      return { rows: users };
    }

    // COUNT messages
    if (sql.includes('SELECT COUNT(*) as count FROM comments c') && sql.includes('WHERE c.published = true')) {
      const classId = Number(params?.[0]);
      const classUserIds = mockDb.classUsers.filter(cu => cu.class_id === classId).map(cu => cu.user_id);
      const count = mockDb.comments.filter(c => c.published && classUserIds.includes(c.target_user_id)).length;
      return { rows: [{ count }] };
    }

    return { rows: [] };
  })
}));

jest.mock('../../services/emailService', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendVerificationEmail: jest.fn()
}));

import { classRoutes } from '../classRoutes';

describe('Class Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/classes', classRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/classes', () => {
    it('should return all class years', async () => {
      const response = await request(app).get('/api/classes');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('classes');
      expect(Array.isArray(response.body.classes)).toBe(true);
      expect(response.body.classes.length).toBeGreaterThan(0);
    });

    it('should return classes with id and year', async () => {
      const response = await request(app).get('/api/classes');

      expect(response.status).toBe(200);
      const firstClass = response.body.classes[0];
      expect(firstClass).toHaveProperty('id');
      expect(firstClass).toHaveProperty('year');
    });

    it('should handle database error', async () => {
      const { query } = require('../../db');
      query.mockImplementationOnce(async () => { throw new Error('Database error'); });

      const response = await request(app).get('/api/classes');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/classes/:id', () => {
    it('should return a specific class', async () => {
      const response = await request(app).get('/api/classes/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('class');
      expect(response.body.class.id).toBe(1);
      expect(response.body.class).toHaveProperty('year');
    });

    it('should return 404 for non-existent class', async () => {
      const response = await request(app).get('/api/classes/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => { throw new Error('Database error'); });

      const response = await request(app).get('/api/classes/1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/classes/:id/members', () => {
    it('should return members of a class', async () => {
      const response = await request(app).get('/api/classes/1/members');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('members');
      expect(Array.isArray(response.body.members)).toBe(true);
    });

    it('should return members with user info', async () => {
      const response = await request(app).get('/api/classes/1/members');

      expect(response.status).toBe(200);
      expect(response.body.members.length).toBeGreaterThan(0);
      const member = response.body.members[0];
      expect(member).toHaveProperty('id');
      expect(member).toHaveProperty('email');
      expect(member).toHaveProperty('first_name');
      expect(member).toHaveProperty('last_name');
    });

    it('should return empty array for class with no members', async () => {
      const response = await request(app).get('/api/classes/999/members');

      expect(response.status).toBe(200);
      expect(response.body.members.length).toBe(0);
    });

    it('should handle database error', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => { throw new Error('Database error'); });

      const response = await request(app).get('/api/classes/1/members');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/classes/:id/alumni-count', () => {
    it('should return alumni count for a class', async () => {
      const response = await request(app).get('/api/classes/1/alumni-count');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('count');
      expect(typeof response.body.count).toBe('number');
    });

    it('should return 0 for class with no members', async () => {
      const response = await request(app).get('/api/classes/999/alumni-count');

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(0);
    });

    it('should handle database error', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => { throw new Error('Database error'); });

      const response = await request(app).get('/api/classes/1/alumni-count');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/classes/:id/recently-joined', () => {
    it('should return recently joined users', async () => {
      const response = await request(app).get('/api/classes/1/recently-joined');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(Array.isArray(response.body.users)).toBe(true);
    });

    it('should return max 3 users', async () => {
      const response = await request(app).get('/api/classes/1/recently-joined');

      expect(response.status).toBe(200);
      expect(response.body.users.length).toBeLessThanOrEqual(3);
    });

    it('should handle database error', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => { throw new Error('Database error'); });

      const response = await request(app).get('/api/classes/1/recently-joined');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/classes/:id/message-count', () => {
    it('should return message count for a class', async () => {
      const response = await request(app).get('/api/classes/1/message-count');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('count');
      expect(typeof response.body.count).toBe('number');
    });

    it('should handle database error', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => { throw new Error('Database error'); });

      const response = await request(app).get('/api/classes/1/message-count');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/classes/:id/directory', () => {
    it('should require userId query parameter', async () => {
      const response = await request(app).get('/api/classes/1/directory');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should deny access for user not in class', async () => {
      const response = await request(app).get('/api/classes/1/directory?userId=999');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should return directory for authorized user', async () => {
      const response = await request(app).get('/api/classes/1/directory?userId=1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(Array.isArray(response.body.users)).toBe(true);
    });

    it('should include photo URLs in directory', async () => {
      const response = await request(app).get('/api/classes/1/directory?userId=1');

      expect(response.status).toBe(200);
      if (response.body.users.length > 0) {
        const user = response.body.users[0];
        expect(user).toHaveProperty('now_photo_url');
        expect(user).toHaveProperty('then_photo_url');
      }
    });

    it('should handle database error', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => { throw new Error('Database error'); });

      const response = await request(app).get('/api/classes/1/directory?userId=1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
});
