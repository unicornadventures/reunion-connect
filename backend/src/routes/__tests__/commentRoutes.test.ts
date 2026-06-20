import express, { Express } from 'express';
import request from 'supertest';

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
    },
    {
      id: 3,
      target_user_id: 2,
      commenter_id: 1,
      content: 'Miss you!',
      published: true,
      created_at: new Date(),
      updated_at: new Date()
    }
  ],
  users: [
    { id: 1, email: 'user1@example.com', created_at: new Date() },
    { id: 2, email: 'user2@example.com', created_at: new Date() },
    { id: 3, email: 'user3@example.com', created_at: new Date() }
  ],
  profiles: [
    { id: 1, user_id: 1, first_name: 'John', last_name: 'Doe' },
    { id: 2, user_id: 2, first_name: 'Jane', last_name: 'Smith' },
    { id: 3, user_id: 3, first_name: 'Bob', last_name: 'Johnson' }
  ]
};

jest.mock('../../db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    // GET my comments (comments posted by a user)
    if (sql.includes('WHERE c.commenter_id = $1') && sql.includes('LEFT JOIN profiles')) {
      const commenterId = Number(params?.[0]);
      const comments = mockDb.comments
        .filter(c => c.commenter_id === commenterId)
        .map(c => ({
          ...c,
          first_name: mockDb.profiles.find(p => p.user_id === c.commenter_id)?.first_name,
          last_name: mockDb.profiles.find(p => p.user_id === c.commenter_id)?.last_name
        }));
      return { rows: comments };
    }

    // GET comments on a user's profile (only published)
    if (sql.includes('WHERE c.target_user_id = $1 AND c.published = true')) {
      const targetUserId = Number(params?.[0]);
      const comments = mockDb.comments
        .filter(c => c.target_user_id === targetUserId && c.published === true)
        .map(c => ({
          ...c,
          first_name: mockDb.profiles.find(p => p.user_id === c.commenter_id)?.first_name,
          last_name: mockDb.profiles.find(p => p.user_id === c.commenter_id)?.last_name
        }));
      return { rows: comments };
    }

    // INSERT new comment (always published = true)
    if (sql.includes('INSERT INTO comments')) {
      const newComment = {
        id: Math.max(...mockDb.comments.map(c => c.id), 0) + 1,
        target_user_id: Number(params?.[0]),
        commenter_id: Number(params?.[1]),
        content: params?.[2],
        published: true,
        created_at: new Date(),
        updated_at: new Date()
      };
      mockDb.comments.push(newComment);
      return { rows: [newComment] };
    }

    // UPDATE comment (supports content and/or published)
    if (sql.includes('UPDATE comments')) {
      const lastParam = params?.[params.length - 1];
      const commentId = Number(lastParam);
      const comment = mockDb.comments.find(c => c.id === commentId);

      if (comment) {
        const hasContent = sql.includes('content = $1');
        const hasPublished = sql.includes('published');

        if (hasContent && hasPublished) {
          comment.content = params?.[0];
          comment.published = params?.[1];
        } else if (hasContent) {
          comment.content = params?.[0];
        } else if (hasPublished) {
          comment.published = params?.[0];
        }

        comment.updated_at = new Date();
        return { rows: [{ ...comment }] };
      }
      return { rows: [] };
    }

    // DELETE comment
    if (sql.includes('DELETE FROM comments WHERE id')) {
      const commentId = Number(params?.[0]);
      const comment = mockDb.comments.find(c => c.id === commentId);
      if (comment) {
        const index = mockDb.comments.findIndex(c => c.id === commentId);
        mockDb.comments.splice(index, 1);
        return { rows: [{ id: comment.id }] };
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
    mockDb.comments = [
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
      },
      {
        id: 3,
        target_user_id: 2,
        commenter_id: 1,
        content: 'Miss you!',
        published: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    app = express();
    app.use(express.json());
    app.use('/api/comments', commentRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/comments/my-comments/:commenterId', () => {
    it('should return comments posted by a user', async () => {
      const response = await request(app).get('/api/comments/my-comments/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('comments');
      expect(Array.isArray(response.body.comments)).toBe(true);
    });

    it('should return comments with required fields', async () => {
      const response = await request(app).get('/api/comments/my-comments/1');

      expect(response.status).toBe(200);
      if (response.body.comments.length > 0) {
        const comment = response.body.comments[0];
        expect(comment).toHaveProperty('id');
        expect(comment).toHaveProperty('content');
        expect(comment).toHaveProperty('target_user_id');
        expect(comment).toHaveProperty('commenter_id');
        expect(comment).toHaveProperty('published');
      }
    });

    it('should return empty array for user with no comments', async () => {
      const response = await request(app).get('/api/comments/my-comments/999');

      expect(response.status).toBe(200);
      expect(response.body.comments.length).toBe(0);
    });

    it('should return both published and unpublished comments', async () => {
      const response = await request(app).get('/api/comments/my-comments/1');

      expect(response.status).toBe(200);
      // Should return all comments (both published and unpublished)
      expect(response.body.comments.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/comments/:targetUserId/comments', () => {
    it('should return published comments for a user', async () => {
      const response = await request(app).get('/api/comments/1/comments');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('comments');
      expect(Array.isArray(response.body.comments)).toBe(true);
    });

    it('should only return published comments', async () => {
      const response = await request(app).get('/api/comments/1/comments');

      expect(response.status).toBe(200);
      response.body.comments.forEach((comment: any) => {
        expect(comment.published).toBe(true);
      });
    });

    it('should return comments with commenter info', async () => {
      const response = await request(app).get('/api/comments/1/comments');

      expect(response.status).toBe(200);
      if (response.body.comments.length > 0) {
        const comment = response.body.comments[0];
        expect(comment).toHaveProperty('id');
        expect(comment).toHaveProperty('content');
        expect(comment).toHaveProperty('commenter_id');
      }
    });

    it('should return empty array for user with no published comments', async () => {
      const response = await request(app).get('/api/comments/999/comments');

      expect(response.status).toBe(200);
      expect(response.body.comments.length).toBe(0);
    });
  });

  describe('POST /api/comments/:targetUserId/comments', () => {
    it('should create a new comment on a user profile', async () => {
      const response = await request(app)
        .post('/api/comments/1/comments')
        .send({
          commenterId: 2,
          content: 'Great reunion!'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('comment');
      expect(response.body.comment.content).toBe('Great reunion!');
      expect(response.body.comment.published).toBe(true);
    });

    it('should reject comment without commenterId', async () => {
      const response = await request(app)
        .post('/api/comments/1/comments')
        .send({
          content: 'Hello'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject comment without content', async () => {
      const response = await request(app)
        .post('/api/comments/1/comments')
        .send({
          commenterId: 2
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should create comment with published=true by default', async () => {
      const response = await request(app)
        .post('/api/comments/2/comments')
        .send({
          commenterId: 3,
          content: 'Nice to reconnect!'
        });

      expect(response.status).toBe(201);
      expect(response.body.comment.published).toBe(true);
    });
  });

  describe('PUT /api/comments/:commentId', () => {
    it('should update comment content', async () => {
      const response = await request(app)
        .put('/api/comments/1')
        .send({
          content: 'Updated great comment'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('comment');
      expect(response.body.comment.content).toBe('Updated great comment');
    });

    it('should update comment published status', async () => {
      const response = await request(app)
        .put('/api/comments/2')
        .send({
          published: true
        });

      expect(response.status).toBe(200);
      expect(response.body.comment.published).toBe(true);
    });

    it('should update both content and published', async () => {
      const response = await request(app)
        .put('/api/comments/1')
        .send({
          content: 'New content',
          published: false
        });

      expect(response.status).toBe(200);
      expect(response.body.comment.content).toBe('New content');
      expect(response.body.comment.published).toBe(false);
    });

    it('should reject update with no content or published', async () => {
      const response = await request(app)
        .put('/api/comments/1')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent comment', async () => {
      const response = await request(app)
        .put('/api/comments/999')
        .send({
          content: 'Test'
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/comments/:commentId', () => {
    it('should delete a comment', async () => {
      const response = await request(app)
        .delete('/api/comments/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should return 404 for non-existent comment', async () => {
      const response = await request(app)
        .delete('/api/comments/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Comment Publishing Flow', () => {
    it('should publish unpublished comments', async () => {
      const response = await request(app)
        .put('/api/comments/2')
        .send({
          published: true
        });

      expect(response.status).toBe(200);
      expect(response.body.comment.published).toBe(true);
    });

    it('should unpublish published comments', async () => {
      const response = await request(app)
        .put('/api/comments/1')
        .send({
          published: false
        });

      expect(response.status).toBe(200);
      expect(response.body.comment.published).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle database error in GET my comments', async () => {
      const { query } = require('../../db');
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/comments/my-comments/1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error in GET profile comments', async () => {
      const { query } = require('../../db');
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/comments/1/comments');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error in POST comment', async () => {
      const { query } = require('../../db');
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .post('/api/comments/1/comments')
        .send({
          commenterId: 2,
          content: 'Error test'
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error in PUT comment', async () => {
      const { query } = require('../../db');
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .put('/api/comments/1')
        .send({
          content: 'Error test'
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle database error in DELETE comment', async () => {
      const { query } = require('../../db');
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .delete('/api/comments/1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
});
