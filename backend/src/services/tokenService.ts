import crypto from 'crypto';

interface ResetToken {
  token: string;
  hash: string;
  expiresAt: string; // ISO string for PostgreSQL
}

export const generateResetToken = (): ResetToken => {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');

  // Calculate expiry time as ISO string (1 hour from now)
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  return { token, hash, expiresAt };
};

export const verifyResetToken = (storedHash: string, providedToken: string): boolean => {
  const providedHash = crypto.createHash('sha256').update(providedToken).digest('hex');
  return storedHash === providedHash;
};
