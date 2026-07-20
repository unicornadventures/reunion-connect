import * as crypto from 'crypto';
import jwt from 'jsonwebtoken'; // 🚨 Make sure to npm i jsonwebtoken @types/jsonwebtoken if not done yet

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-super-secret-key';

/**
 * Securely hashes a password/keyword using SHA256.
 */
export function hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * 🚨 MISSING MIDDLEWARE: Authenticates incoming requests via Cookies or Bearer Tokens
 */
export function authenticateToken(req: any, res: any, next: any) {
    // 1. Try to grab the token from cookies (Express cookies middleware) or the Authorization header
    const token = req.cookies?.token || req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No session token provided.' });
    }

    try {
        // 2. Decode and verify the token signature
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // 3. Attach the parsed user record to the request object so downstream routes can see it
        req.user = decoded; 
        
        next(); // Pass control to your route handler (like the /me endpoint)
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired session token.' });
    }
}