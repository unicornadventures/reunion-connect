import express, { Express } from 'express';
import request from 'supertest';

const mockDb = {
  classes: [
    { id: 1, school_id: 1, year: 2020, school_name: 'Lincoln High', created_at: new Date(), updated_at: new Date() },
    { id: 2, school_id: 1, year: 2021, school_name: 'Lincoln High', created_at: new Date(), updated_at: new Date() }
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
    { id: 1, user_id: 1, first_name: 'John', last_name: 'Doe', nickname_school: '', now_photo_url: null, then_photo_url: null },
    { id: 2, user_id: 2, first_name: 'Jane', last_name: 'Smith', nickname_school: '', now_photo_url: null, then_photo_url: null },
    { id: 3, user_id: 3, first_name: 'Bob', last_name: 'Johnson', nickname_school: 'Bobby', now_photo_url: 'https://example.com/bob_now.jpg', then_photo_url: 'https://example.com/bob_then.jpg' }
  ],
  classUsers: [
    { id: 1, class_id: 1, user_id: 1 },
    { id: 2, class_id: 1, user_id: 2 },
    { id: 3, class_id: 2, user_id: 3 }
  ],
  comments: [
    { id: 1, target_user_id: 1, commenter_id: 2, content: 'Great to see you!', published: true, created_at: new Date() },
    { id: 2, target_user_id: 2, commenter_id: 1, content: 'How have you been?', published: true, created_at: new Date() }
  ]
};

jest.mock('../../db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    // GET all classes
    if (sql.includes('SELECT c.id, c.year, c.school_id, s.name as school_name') && !sql.includes('WHERE')) {
      return {
        rows: mockDb.classes.map(c => ({
          id: c.id,
          year: c.year,
          school_id: c.school_id,
          school_name: c.school_name,
          created_at: c.created_at,
          updated_at: c.updated_at
        }))
      };
    }

    // GET single class by id
    if (sql.includes('SELECT c.id, c.year, c.school_id, s.name as school_name') && sql.includes('WHERE c.id')) {
      const classId = Number(params?.[0]);
      const cls = mockDb.classes.find(c => c.id === classId);
      if (cls) {
        return {
          rows: [{
            id: cls.id,
            year: cls.year,
            school_id: cls.school_id,
            school_name: cls.school_name,
            created_at: cls.created_at,
            updated_at: cls.updated_at
          }]
        };
      }
      return { rows: [] };
    }

    // GET class members
    if (sql.includes('SELECT u.id, u.email, p.first_name, p.last_name, p.nickname_school') && sql.includes('class_user')) {
      const classId = Number(params?.[0]);
      const members = mockDb.classUsers
        .filter(cu => cu.class_id === classId)
        .map(cu => {
          const user = mockDb.users.find(u => u.id === cu.user_id);
          const profile = mockDb.profiles.find(p => p.user_id === cu.user_id);
          return user && profile ? {
            id: user.id,
            email: user.email,
            first_name: profile.first_name,
            last_name: profile.last_name,
            nickname_school: profile.nickname_school
          } : null;
        })
        .filter(Boolean);
      return { rows: members };
    }

    // GET class directory
    if (sql.includes('SELECT class_id FROM class_user WHERE user_id') && sql.includes('AND class_id')) {
      const userId = Number(params?.[0]);
      const classId = Number(params?.[1]);
      const found = mockDb.classUsers.find(cu => cu.user_id === userId && cu.class_id === classId);
      return { rows: found ? [{ class_id: classId }] : [] };
    }

    // GET directory users
    if (sql.includes('SELECT') && sql.includes('now_photo_url, p.then_photo_url') && sql.includes('class_user')) {
      const classId = Number(params?.[0]);
      const users = mockDb.classUsers
        .filter(cu => cu.class_id === classId)
        .map(cu => {
          const user = mockDb.users.find(u => u.id === cu.user_id);
          const profile = mockDb.profiles.find(p => p.user_id === cu.user_id);
          return user && profile ? {
            id: user.id,
            email: user.email,
            first_name: profile.first_name,
            last_name: profile.last_name,
            nickname_school: profile.nickname_school,
            now_photo_url: profile.now_photo_url,
            then_photo_url: profile.then_photo_url
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
            id: user.id,
            email: user.email,
            created_at: user.created_at,
            first_name: profile.first_name,
            last_name: profile.last_name,
            nickname_school: profile.nickname_school,
            now_photo_url: profile.now_photo_url,
            then_photo_url: profile.then_photo_url
          } : null;
        })
        .filter(Boolean)
        .slice(0, 3);
      return { rows: users };
    }

    // COUNT messages (published comments)
    if (sql.includes('SELECT COUNT(*) as count FROM comments c') && sql.includes('WHERE c.published = true')) {
      const classId = Number(params?.[0]);
      const classUsers = mockDb.classUsers.filter(cu => cu.class_id === classId).map(cu => cu.user_id);
      const count = mockDb.comments.filter(c => c.published && classUsers.includes(c.target_user_id)).length;
      return { rows: [{ count }] };
    }

    // Check if school exists
    if (sql.includes('SELECT id FROM schools WHERE id')) {
      const schoolId = Number(params?.[0]);
      const school = mockDb.schools.find(s => s.id === schoolId);
      return school ? { rows: [{ id: school.id }] } : { rows: [] };
    }

    // INSERT new class
    if (sql.includes('INSERT INTO classes')) {
      const schoolId = Number(params?.[0]);
      const year = Number(params?.[1]);
      const newClass = {
        id: Math.max(...mockDb.classes.map(c => c.id), 0) + 1,
        school_id: schoolId,
        year: year,
        school_name: mockDb.schools.find(s => s.id === schoolId)?.name || 'Unknown',
        created_at: new Date(),
        updated_at: new Date()
      };
      mockDb.classes.push(newClass);
      return { rows: [newClass] };
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
    it('should return all classes', async () => {
      const response = await request(app).get('/api/classes');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('classes');
      expect(Array.isArray(response.body.classes)).toBe(true);
      expect(response.body.classes.length).toBeGreaterThan(0);
    });

    it('should return classes with required fields', async () => {
      const response = await request(app).get('/api/classes');

      expect(response.status).toBe(200);
      const firstClass = response.body.classes[0];
      expect(firstClass).toHaveProperty('id');
      expect(firstClass).toHaveProperty('year');
      expect(firstClass).toHaveProperty('school_id');
      expect(firstClass).toHaveProperty('school_name');
    });
  });

  describe('POST /api/classes', () => {
    it('should create a new class', async () => {
      const response = await request(app)
        .post('/api/classes')
        .send({
          school_id: 1,
          year: 2025
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('class');
      expect(response.body.class.school_id).toBe(1);
      expect(response.body.class.year).toBe(2025);
    });

    it('should return created class with all fields', async () => {
      const response = await request(app)
        .post('/api/classes')
        .send({
          school_id: 1,
          year: 2026
        });

      expect(response.status).toBe(201);
      const createdClass = response.body.class;
      expect(createdClass).toHaveProperty('id');
      expect(createdClass).toHaveProperty('school_id');
      expect(createdClass).toHaveProperty('year');
      expect(createdClass).toHaveProperty('created_at');
      expect(createdClass).toHaveProperty('updated_at');
    });

    it('should reject missing school_id', async () => {
      const response = await request(app)
        .post('/api/classes')
        .send({
          year: 2025
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('school_id');
    });

    it('should reject missing year', async () => {
      const response = await request(app)
        .post('/api/classes')
        .send({
          school_id: 1
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('year');
    });

    it('should reject non-existent school_id', async () => {
      const response = await request(app)
        .post('/api/classes')
        .send({
          school_id: 999,
          year: 2025
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('School not found');
    });

    it('should handle database error during creation', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .post('/api/classes')
        .send({
          school_id: 1,
          year: 2025
        });

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
    });

    it('should return 404 for non-existent class', async () => {
      const response = await request(app).get('/api/classes/999');

      expect(response.status).toBe(404);
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
  });

  describe('GET /api/classes/:id/message-count', () => {
    it('should return message count for a class', async () => {
      const response = await request(app).get('/api/classes/1/message-count');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('count');
      expect(typeof response.body.count).toBe('number');
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
  });

  describe('Error Handling', () => {
    it('should handle database error in GET all classes', async () => {
      const { query } = require('../../db');
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/classes');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error in GET single class', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/classes/1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error in GET members', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/classes/1/members');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error in GET recently-joined', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/classes/1/recently-joined');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error in GET message-count', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/classes/1/message-count');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error in GET directory', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/classes/1/directory?userId=1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error in GET alumni-count', async () => {
      const { query } = require('../../db');
      jest.clearAllMocks();
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/classes/1/alumni-count');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
});
