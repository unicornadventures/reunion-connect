import { query } from '../db.ts';

export interface AuthRequest {
  headers: Record<string, any>;
  user?: any;
}

export async function requireAdmin(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization token.' });
    }

    const token = authHeader.substring(7);
    const userResult = await query('SELECT * FROM users WHERE id = $1', [parseInt(token)]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found.' });
    }

    const user = userResult.rows[0];
    if (!user.is_admin) {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication error.' });
  }
}
