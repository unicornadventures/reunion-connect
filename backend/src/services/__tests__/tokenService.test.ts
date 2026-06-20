import { generateResetToken, verifyResetToken } from '../tokenService';

describe('Token Service', () => {
  describe('generateResetToken', () => {
    it('should generate a token with token, hash, and expiresAt', () => {
      const { token, hash, expiresAt } = generateResetToken();

      expect(token).toBeDefined();
      expect(hash).toBeDefined();
      expect(expiresAt).toBeDefined();
      expect(typeof token).toBe('string');
      expect(typeof hash).toBe('string');
      expect(typeof expiresAt).toBe('string');
    });

    it('should generate a 64-character hex token (32 bytes)', () => {
      const { token } = generateResetToken();
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate a 64-character hex hash (SHA256)', () => {
      const { hash } = generateResetToken();
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate ISO formatted expiry time', () => {
      const { expiresAt } = generateResetToken();
      // Should be ISO 8601 format
      expect(() => new Date(expiresAt)).not.toThrow();
      expect(expiresAt).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.?\d*Z/);
    });

    it('should generate unique tokens on each call', () => {
      const token1 = generateResetToken().token;
      const token2 = generateResetToken().token;
      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyResetToken', () => {
    it('should return true for matching token and hash', () => {
      const { token, hash } = generateResetToken();
      const isValid = verifyResetToken(hash, token);
      expect(isValid).toBe(true);
    });

    it('should return false for non-matching token and hash', () => {
      const { hash } = generateResetToken();
      const wrongToken = generateResetToken().token;
      const isValid = verifyResetToken(hash, wrongToken);
      expect(isValid).toBe(false);
    });

    it('should return false for empty token', () => {
      const { hash } = generateResetToken();
      const isValid = verifyResetToken(hash, '');
      expect(isValid).toBe(false);
    });

    it('should return false for malformed hash', () => {
      const { token } = generateResetToken();
      const isValid = verifyResetToken('not-a-valid-hash', token);
      expect(isValid).toBe(false);
    });
  });
});
