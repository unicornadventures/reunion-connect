import express, { Express } from 'express';
import request from 'supertest';

let mockDb: {
  feedback: {
    id: number;
    user_id: number;
    comment: string;
    created_at: Date;
  }[];
};

jest.mock('../../db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    // GET own feedback
    if (sql.includes('SELECT') && sql.includes('FROM feedback') && sql.includes('WHERE user_id = $1')) {
      const userId = Number(params?.[0]);
      const rows = mockDb.feedback
        .filter(f => f.user_id === userId)
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      return { rows };
    }

    // INSERT feedback
    if (sql.includes('INSERT INTO feedback')) {
      const newFeedback = {
        id: mockDb.feedback.length + 1,
        user_id: Number(params?.[0]),
        comment: String(params?.[1]),
        created_at: new Date()
      };
      mockDb.feedback.push(newFeedback);
      return { rows: [newFeedback] };
    }

    return { rows: [] };
  })
}));

// Authenticated requester is user 2 (a regular user)
jest.mock('../../utils/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 2, email: 'user2@example.com', is_admin: false };
    next();
  }
}));

import { feedbackRoutes } from '../feedbackRoutes';
import { query } from '../../db';

describe('Feedback Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/feedback', feedbackRoutes);

    mockDb = {
      feedback: [
        { id: 1, user_id: 2, comment: 'Love the slideshow!', created_at: new Date('2026-07-01') },
        { id: 2, user_id: 3, comment: 'Please add a chat feature.', created_at: new Date('2026-07-02') },
        { id: 3, user_id: 2, comment: 'The directory search is great.', created_at: new Date('2026-07-03') }
      ]
    };

    delete process.env.FEEDBACK_ENABLED;
    jest.clearAllMocks();
  });

  afterAll(() => {
    delete process.env.FEEDBACK_ENABLED;
  });

  describe('GET /api/feedback', () => {
    it('should return only the authenticated user\'s own feedback', async () => {
      const response = await request(app).get('/api/feedback');

      expect(response.status).toBe(200);
      expect(response.body.feedback).toHaveLength(2);
      expect(response.body.feedback.every((f: any) => f.user_id === 2)).toBe(true);
    });

    it('should return newest feedback first', async () => {
      const response = await request(app).get('/api/feedback');

      expect(response.status).toBe(200);
      expect(response.body.feedback[0].id).toBe(3);
      expect(response.body.feedback[1].id).toBe(1);
    });

    it('should return an empty list when the user has no feedback', async () => {
      mockDb.feedback = [];

      const response = await request(app).get('/api/feedback');

      expect(response.status).toBe(200);
      expect(response.body.feedback).toEqual([]);
    });

    it('should return 500 on database error', async () => {
      (query as jest.Mock).mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/feedback');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Could not fetch feedback.');
    });
  });

  describe('POST /api/feedback', () => {
    it('should create feedback for the authenticated user', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .send({ comment: 'A dark mode would be nice.' });

      expect(response.status).toBe(201);
      expect(response.body.feedback.user_id).toBe(2);
      expect(response.body.feedback.comment).toBe('A dark mode would be nice.');
      expect(mockDb.feedback).toHaveLength(4);
    });

    it('should trim surrounding whitespace from the comment', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .send({ comment: '  needs more cowbell  ' });

      expect(response.status).toBe(201);
      expect(response.body.feedback.comment).toBe('needs more cowbell');
    });

    it('should return 400 when comment is missing', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Comment is required.');
    });

    it('should return 400 when comment is only whitespace', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .send({ comment: '   ' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Comment is required.');
    });

    it('should return 500 on database error', async () => {
      (query as jest.Mock).mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .post('/api/feedback')
        .send({ comment: 'This will fail.' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Could not create feedback.');
    });
  });

  describe('feature flag', () => {
    it('should return 404 for GET when FEEDBACK_ENABLED is false', async () => {
      process.env.FEEDBACK_ENABLED = 'false';

      const response = await request(app).get('/api/feedback');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Feedback is not enabled.');
    });

    it('should return 404 for POST when FEEDBACK_ENABLED is false', async () => {
      process.env.FEEDBACK_ENABLED = 'false';

      const response = await request(app)
        .post('/api/feedback')
        .send({ comment: 'Should not be saved.' });

      expect(response.status).toBe(404);
      expect(mockDb.feedback).toHaveLength(3);
    });

    it('should allow requests when FEEDBACK_ENABLED is explicitly true', async () => {
      process.env.FEEDBACK_ENABLED = 'true';

      const response = await request(app).get('/api/feedback');

      expect(response.status).toBe(200);
    });
  });
});
