import { hashPassword, authenticateToken } from '../auth';
import jwt from 'jsonwebtoken';

describe('Auth Utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password to SHA256', () => {
      const password = 'testPassword123';
      const hash = hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA256 produces 64 hex characters
    });

    it('should produce consistent hashes for same input', () => {
      const password = 'testPassword123';
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashPassword('password1');
      const hash2 = hashPassword('password2');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = hashPassword('');
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    it('should handle special characters', () => {
      const password = 'p@ssw0rd!#$%^&*()';
      const hash = hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    it('should handle long passwords', () => {
      const password = 'a'.repeat(1000);
      const hash = hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });
  });

  describe('authenticateToken', () => {
    let req: any;
    let res: any;
    let next: jest.Mock;

    beforeEach(() => {
      req = {
        cookies: {},
        headers: {}
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });

    it('should call next() with valid token in cookies', () => {
      const JWT_SECRET = process.env.JWT_SECRET || 'fallback-super-secret-key';
      const payload = { id: 1, email: 'test@example.com' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

      req.cookies.token = token;

      authenticateToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(req.user).toEqual(expect.objectContaining(payload));
    });

    it('should call next() with valid token in Authorization header', () => {
      const JWT_SECRET = process.env.JWT_SECRET || 'fallback-super-secret-key';
      const payload = { id: 2, email: 'user@example.com' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

      req.headers.authorization = `Bearer ${token}`;

      authenticateToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(req.user).toEqual(expect.objectContaining(payload));
    });

    it('should return 401 when no token provided', () => {
      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(String) })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 with invalid token', () => {
      req.cookies.token = 'invalid.token.here';

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(String) })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 with expired token', () => {
      const JWT_SECRET = process.env.JWT_SECRET || 'fallback-super-secret-key';
      const payload = { id: 1, email: 'test@example.com' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '-1h' }); // Expired

      req.cookies.token = token;

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(String) })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should prefer cookies over Authorization header', () => {
      const JWT_SECRET = process.env.JWT_SECRET || 'fallback-super-secret-key';
      const payload = { id: 1, email: 'test@example.com' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

      req.cookies.token = token;
      req.headers.authorization = 'Bearer invalid.token';

      authenticateToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual(expect.objectContaining(payload));
    });

    it('should extract user data from token payload', () => {
      const JWT_SECRET = process.env.JWT_SECRET || 'fallback-super-secret-key';
      const payload = {
        id: 42,
        email: 'complex@example.com',
        is_admin: true,
        profile: { first_name: 'John', last_name: 'Doe' }
      };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

      req.cookies.token = token;

      authenticateToken(req, res, next);

      expect(req.user.id).toBe(42);
      expect(req.user.email).toBe('complex@example.com');
      expect(req.user.is_admin).toBe(true);
      expect(req.user.profile).toEqual({ first_name: 'John', last_name: 'Doe' });
    });

    it('should handle Authorization header with malformed format', () => {
      req.headers.authorization = 'BearerInvalidFormat';

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
