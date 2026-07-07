import jwt from 'jsonwebtoken';
import { APIGatewayProxyEvent } from 'aws-lambda';

export interface AuthUser {
  id: number;
  email: string;
  is_admin: boolean;
  is_class_admin: boolean;
}

/**
 * Verify the Bearer token on a request. Returns the decoded user, or null
 * if the Authorization header is missing or the token is invalid/expired.
 * The fallback secret must match the one used to sign tokens in auth.ts.
 */
export function getAuthUser(event: APIGatewayProxyEvent): AuthUser | null {
  const header = event.headers?.Authorization ?? event.headers?.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;

  try {
    return jwt.verify(header.slice('Bearer '.length), process.env.JWT_SECRET || 'fallback-secret') as AuthUser;
  } catch {
    return null;
  }
}
