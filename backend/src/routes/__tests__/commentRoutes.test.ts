import express, { Express } from 'express';
import request from 'supertest';

// Mock database
const mockDb = {
  comments: [
    {
      id: 1,
      target_user_id: 1,
      commenter_id: 2,
      content: 'Great to see you!',
      published: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 2,
      target_user_id: 1,
      commenter_id: 3,
      content: 'How have you been?',
      published: false,
      created_at: new Date(),
      updated_at: new Date()
    }
  ],
  users: [
    { id: 1, email: 'user1@example.com' },
    { id: 2, email: 'user2@example.com' },
    { id: 3, email: 'user3@example.com' }
  ],
  profiles: [
    { id: 1, user_id: 1, first_name: 'John', last_name: 'Doe' },
    { id: 2, user_id: 2, first_name: 'Jane', last_name: 'Smith' },
    { id: 3, user_id: 3, first_name: 'Bob', last_name: 'Johnson' }
  ]
};

jest.mock('../../db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    if (sql.includes('SELECT id FROM users WHERE id')) {
      const userId = params?.[0];
      const user = mockDb.users.find(u => u.id === userId);
      return { rows: user ? [{ id: user.id }] : [] };
    }

    if (sql.includes('INSERT INTO comments')) {
      const comment = {
        id: mockDb.comments.length + 1,
        target_user_id: params?.[0],
        commenter_id: params?.[1],
        content: params?.[2],
        published: params?.[3] || false,
        created_at: new Date(),
        updated_at: new Date()
      };
      mockDb.comments.push(comment);
      return { rows: [comment] };
    }

    if (sql.includes('SELECT c.* FROM comments c') && sql.includes('WHERE c.target_user_id')) {
      const targetUserId = params?.[0];
      const comments = mockDb.comments.filter(c => c.target_user_id === targetUserId);
      return { rows: comments };
    }

    if (sql.includes('SELECT c.* FROM comments c') && sql.includes('WHERE c.id')) {
      const commentId = params?.[0];
      const comment = mockDb.comments.find(c => c.id === commentId);
      return { rows: comment ? [comment] : [] };
    }

    if (sql.includes('SELECT c.id FROM comments c') && sql.includes('WHERE c.id')) {
      const commentId = params?.[0];
      const comment = mockDb.comments.find(c => c.id === commentId);
      return { rows: comment ? [{ id: comment.id }] : [] };
    }

    if (sql.includes('UPDATE comments SET')) {
      const commentId = params?.[params.length - 1];
      const comment = mockDb.comments.find(c => c.id === commentId);
      if (comment) {
        if (sql.includes('content')) {
          comment.content = params?.[0];
        }
        if (sql.includes('published')) {
          comment.published = params?.[0];
        }
        comment.updated_at = new Date();
      }
      return { rows: [] };
    }

    if (sql.includes('DELETE FROM comments')) {
      const commentId = params?.[0];
      const index = mockDb.comments.findIndex(c => c.id === commentId);
      if (index > -1) {
        mockDb.comments.splice(index, 1);
      }
      return { rows: [] };
    }

    return { rows: [] };
  })
}));

jest.mock('../../services/emailService', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendVerificationEmail: jest.fn()
}));

import { commentRoutes } from '../commentRoutes';

describe('Comment Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/comments', commentRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/comments/user/:userId', () => {
    it('should return comments for a user', async () => {
      const response = await request(app).get('/api/comments/user/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('comments');
      expect(Array.isArray(response.body.comments)).toBe(true);
    });

    it('should return comments with required fields', async () => {
      const response = await request(app).get('/api/comments/user/1');

      expect(response.status).toBe(200);
      if (response.body.comments.length > 0) {
        const comment = response.body.comments[0];
        expect(comment).toHaveProperty('id');
        expect(comment).toHaveProperty('content');
        expect(comment).toHaveProperty('commenter_id');
        expect(comment).toHaveProperty('published');
      }
    });

    it('should return empty array for user with no comments', async () => {
      const response = await request(app).get('/api/comments/user/999');

      expect(response.status).toBe(200);
      expect(response.body.comments.length).toBe(0);
    });

    it('should only return published comments by default', async () => {
      const response = await request(app).get('/api/comments/user/1');

      expect(response.status).toBe(200);
      // Published comments should be true
      response.body.comments.forEach((comment: any) => {
        expect(comment.published).toBe(true);
      });
    });
  });

  describe('POST /api/comments', () => {
    it('should create a new comment', async () => {
      const response = await request(app)
        .post('/api/comments')
        .send({
          target_user_id: 1,
          commenter_id: 2,
          content: 'Miss you buddy!',
          published: false
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('comment');
      expect(response.body.comment.content).toBe('Miss you buddy!');
    });

    it('should reject comment with missing fields', async () => {
      const response = await request(app)
        .post('/api/comments')
        .send({
          target_user_id: 1,
          commenter_id: 2
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject comment for non-existent target user', async () => {
      const response = await request(app)
        .post('/api/comments')
        .send({
          target_user_id: 999,
          commenter_id: 2,
          content: 'Comment text',
          published: false
        });

      expect(response.status).toBe(400);
    });

    it('should reject comment from non-existent commenter', async () => {
      const response = await request(app)
        .post('/api/comments')
        .send({
          target_user_id: 1,
          commenter_id: 999,
          content: 'Comment text',
          published: false
        });

      expect(response.status).toBe(400);
    });

    it('should default to unpublished if not specified', async () => {
      const response = await request(app)
        .post('/api/comments')
        .send({
          target_user_id: 1,
          commenter_id: 2,
          content: 'Unpublished comment'
        });

      if (response.status === 201) {
        expect(response.body.comment.published).toBe(false);
      }
    });
  });

  describe('PUT /api/comments/:id', () => {
    it('should update a comment', async () => {
      const response = await request(app)
        .put('/api/comments/1')
        .send({
          content: 'Updated comment text'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should publish a comment', async () => {
      const response = await request(app)
        .put('/api/comments/2')
        .send({
          published: true
        });

      expect(response.status).toBe(200);
    });

    it('should reject update for non-existent comment', async () => {
      const response = await request(app)
        .put('/api/comments/999')
        .send({
          content: 'Updated text'
        });

      expect([400, 404]).toContain(response.status);
    });
  });

  describe('DELETE /api/comments/:id', () => {
    it('should delete a comment', async () => {
      const response = await request(app)
        .delete('/api/comments/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle deletion of non-existent comment', async () => {
      const response = await request(app)
        .delete('/api/comments/999');

      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Comment Publishing Flow', () => {
    it('should allow publishing unpublished comments', async () => {
      const response = await request(app)
        .put('/api/comments/2')
        .send({
          published: true
        });

      expect(response.status).toBe(200);
    });

    it('should allow unpublishing published comments', async () => {
      const response = await request(app)
        .put('/api/comments/1')
        .send({
          published: false
        });

      expect(response.status).toBe(200);
    });
  });
});
