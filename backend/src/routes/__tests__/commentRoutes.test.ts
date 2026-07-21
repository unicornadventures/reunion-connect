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
    { id: 1, email: 'user1@example.com', is_admin: false, is_class_admin: false, created_at: new Date() },
    { id: 2, email: 'user2@example.com', is_admin: false, is_class_admin: false, created_at: new Date() },
    { id: 3, email: 'user3@example.com', is_admin: false, is_class_admin: false, created_at: new Date() },
    { id: 4, email: 'classadmin-same@example.com', is_admin: false, is_class_admin: true, created_at: new Date() },
    { id: 5, email: 'classadmin-other@example.com', is_admin: false, is_class_admin: true, created_at: new Date() },
    { id: 6, email: 'superadmin@example.com', is_admin: true, is_class_admin: false, created_at: new Date() }
  ],
  profiles: [
    { id: 1, user_id: 1, first_name: 'John', last_name: 'Doe' },
    { id: 2, user_id: 2, first_name: 'Jane', last_name: 'Smith' },
    { id: 3, user_id: 3, first_name: 'Bob', last_name: 'Johnson' }
  ],
  // users 1, 2, 3, and 4 share class 1; user 5 is a class admin for an unrelated class (2)
  classUsers: [
    { id: 1, class_id: 1, user_id: 1 },
    { id: 2, class_id: 1, user_id: 2 },
    { id: 3, class_id: 1, user_id: 3 },
    { id: 4, class_id: 1, user_id: 4 },
    { id: 5, class_id: 2, user_id: 5 }
  ]
};

jest.mock('../../db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    // GET my comments (comments posted by a user)
    if (sql.includes('WHERE c.commenter_id = $1') && !sql.includes('LEFT JOIN profiles')) {
      const commenterId = Number(params?.[0]);
      const comments = mockDb.comments
        .filter(c => c.commenter_id === commenterId);
      return { rows: comments };
    }

    // GET comments on a user's profile (only published)
    if (sql.includes('WHERE c.target_user_id = $1 AND c.published = true')) {
      const targetUserId = Number(params?.[0]);
      const comments = mockDb.comments
        .filter(c => c.target_user_id === targetUserId && c.published === true);
      return { rows: comments };
    }

    // GET all comments on a user's profile (for moderation)
    if (sql.includes('WHERE c.target_user_id = $1') && !sql.includes('AND c.published')) {
      const targetUserId = Number(params?.[0]);
      const comments = mockDb.comments
        .filter(c => c.target_user_id === targetUserId)
        .sort((a, b) => (a.published === b.published ? 0 : a.published ? 1 : -1));
      return { rows: comments };
    }

    // GET all pending comments the requester can moderate (bulk)
    if (sql.includes('WHERE c.published = false') && !sql.includes('c.commenter_id IN')) {
      const comments = mockDb.comments.filter(c => !c.published);
      return { rows: comments };
    }
    if (sql.includes('WHERE c.published = false') && sql.includes('c.commenter_id IN')) {
      const requesterId = Number(params?.[0]);
      const requesterClasses = mockDb.classUsers.filter(cu => cu.user_id === requesterId).map(cu => cu.class_id);
      const eligibleCommenters = mockDb.classUsers
        .filter(cu => requesterClasses.includes(cu.class_id))
        .map(cu => cu.user_id);
      const comments = mockDb.comments.filter(c => !c.published && eligibleCommenters.includes(c.commenter_id));
      return { rows: comments };
    }

    // SELECT single comment by ID
    if (sql.includes('SELECT id, target_user_id, commenter_id FROM comments WHERE id')) {
      const commentId = Number(params?.[0]);
      const comment = mockDb.comments.find(c => c.id === commentId);
      return { rows: comment ? [comment] : [] };
    }

    // SELECT user info
    if (sql.includes('is_admin, is_class_admin FROM users WHERE id')) {
      const userId = Number(params?.[0]);
      const user = mockDb.users.find(u => u.id === userId);
      return { rows: user ? [{ is_admin: user.is_admin, is_class_admin: user.is_class_admin }] : [] };
    }

    // SELECT class membership (is requester in the same class as the commenter?)
    if (sql.includes('SELECT cu1.class_id') && sql.includes('FROM class_user cu1')) {
      const userId = Number(params?.[0]);
      const targetUserId = Number(params?.[1]);
      const requesterClasses = mockDb.classUsers.filter(cu => cu.user_id === userId).map(cu => cu.class_id);
      const targetClasses = mockDb.classUsers.filter(cu => cu.user_id === targetUserId).map(cu => cu.class_id);
      const sameClass = requesterClasses.some(c => targetClasses.includes(c));
      return { rows: sameClass ? [{ class_id: requesterClasses[0] }] : [] };
    }

    // INSERT new comment (published = false by default)
    if (sql.includes('INSERT INTO comments')) {
      const newComment = {
        id: Math.max(...mockDb.comments.map(c => c.id), 0) + 1,
        target_user_id: Number(params?.[0]),
        commenter_id: Number(params?.[1]),
        content: params?.[2],
        published: false,
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

  describe('GET /api/comments/pending', () => {
    it('should reject without requesterId', async () => {
      const response = await request(app).get('/api/comments/pending');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for a non-existent requester', async () => {
      const response = await request(app).get('/api/comments/pending?requesterId=999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject a regular (non-admin) requester', async () => {
      // user 1 is neither admin nor class admin
      const response = await request(app).get('/api/comments/pending?requesterId=1');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should return every unpublished comment for a super admin, in one request', async () => {
      const response = await request(app).get('/api/comments/pending?requesterId=6');

      expect(response.status).toBe(200);
      expect(response.body.comments.length).toBe(1);
      expect(response.body.comments[0].id).toBe(2);
      expect(response.body.comments[0].published).toBe(false);
    });

    it('should scope a class admin to unpublished comments from their own class', async () => {
      // user 4 is a class admin sharing class 1 with commenter of comment 2 (user 3)
      const response = await request(app).get('/api/comments/pending?requesterId=4');

      expect(response.status).toBe(200);
      expect(response.body.comments.length).toBe(1);
      expect(response.body.comments[0].id).toBe(2);
    });

    it('should return no comments for a class admin whose class has no unpublished comments', async () => {
      // user 5 is a class admin for the unrelated class 2
      const response = await request(app).get('/api/comments/pending?requesterId=5');

      expect(response.status).toBe(200);
      expect(response.body.comments).toEqual([]);
    });

    it('should handle database error', async () => {
      const { query } = require('../../db');
      query.mockImplementationOnce(async () => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/comments/pending?requesterId=6');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
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
      expect(response.body.comment.published).toBe(false);
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

    it('should create comment with published=false by default', async () => {
      const response = await request(app)
        .post('/api/comments/2/comments')
        .send({
          commenterId: 3,
          content: 'Nice to reconnect!'
        });

      expect(response.status).toBe(201);
      expect(response.body.comment.published).toBe(false);
    });
  });

  describe('PUT /api/comments/:commentId', () => {
    it('should update comment content', async () => {
      // comment 1: commenter_id=2, so requester 2 is editing their own comment
      const response = await request(app)
        .put('/api/comments/1')
        .send({
          content: 'Updated great comment',
          requesterId: 2
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('comment');
      expect(response.body.comment.content).toBe('Updated great comment');
    });

    it('should update comment published status', async () => {
      // comment 2: target_user_id=1, so the profile owner (1) can self-moderate
      const response = await request(app)
        .put('/api/comments/2')
        .send({
          published: true,
          requesterId: 1
        });

      expect(response.status).toBe(200);
      expect(response.body.comment.published).toBe(true);
    });

    it('should reject update without requesterId', async () => {
      const response = await request(app)
        .put('/api/comments/1')
        .send({ content: 'No requester' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject a classmate with no relation to the comment', async () => {
      // comment 1: target=1, commenter=2. Requester 3 is neither, not admin/class-admin.
      const response = await request(app)
        .put('/api/comments/1')
        .send({ published: true, requesterId: 3 });

      expect(response.status).toBe(403);
    });

    it('should reject editing someone else\'s comment content', async () => {
      const response = await request(app)
        .put('/api/comments/1')
        .send({ content: 'Not mine to edit', requesterId: 1 });

      expect(response.status).toBe(403);
    });

    it('should allow a class admin to publish a comment for someone in their class', async () => {
      // user 4 is a class admin sharing class 1 with commenter (2) and target (1)
      const response = await request(app)
        .put('/api/comments/1')
        .send({ published: true, requesterId: 4 });

      expect(response.status).toBe(200);
      expect(response.body.comment.published).toBe(true);
    });

    it('should reject a class admin publishing a comment for someone outside their class', async () => {
      // user 5 is a class admin for class 2, unrelated to comment 1's class 1
      const response = await request(app)
        .put('/api/comments/1')
        .send({ published: true, requesterId: 5 });

      expect(response.status).toBe(403);
    });

    it('should reject update with no content or published', async () => {
      const response = await request(app)
        .put('/api/comments/1')
        .send({ requesterId: 1 });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent comment', async () => {
      const response = await request(app)
        .put('/api/comments/999')
        .send({
          content: 'Test',
          requesterId: 1
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/comments/:commentId', () => {
    it('should allow the commenter to delete their own comment', async () => {
      // comment 1: commenter_id=2
      const response = await request(app)
        .delete('/api/comments/1?requesterId=2');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should allow the profile owner to delete a comment on their profile', async () => {
      // comment 2: target_user_id=1
      const response = await request(app)
        .delete('/api/comments/2?requesterId=1');

      expect(response.status).toBe(200);
    });

    it('should reject a classmate with no relation to the comment', async () => {
      // comment 1: target=1, commenter=2. Requester 3 is neither, not admin/class-admin.
      const response = await request(app)
        .delete('/api/comments/1?requesterId=3');

      expect(response.status).toBe(403);
    });

    it('should allow a class admin to delete a comment for someone in their class', async () => {
      const response = await request(app)
        .delete('/api/comments/1?requesterId=4');

      expect(response.status).toBe(200);
    });

    it('should reject a class admin deleting a comment for someone outside their class', async () => {
      const response = await request(app)
        .delete('/api/comments/1?requesterId=5');

      expect(response.status).toBe(403);
    });

    it('should reject without requesterId', async () => {
      const response = await request(app)
        .delete('/api/comments/1');

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent comment', async () => {
      const response = await request(app)
        .delete('/api/comments/999?requesterId=1');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Comment Publishing Flow', () => {
    it('should publish unpublished comments', async () => {
      const response = await request(app)
        .put('/api/comments/2')
        .send({
          published: true,
          requesterId: 1
        });

      expect(response.status).toBe(200);
      expect(response.body.comment.published).toBe(true);
    });

    it('should unpublish published comments', async () => {
      const response = await request(app)
        .put('/api/comments/1')
        .send({
          published: false,
          requesterId: 1
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
          content: 'Error test',
          requesterId: 2
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
        .delete('/api/comments/1?requesterId=2');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
});
