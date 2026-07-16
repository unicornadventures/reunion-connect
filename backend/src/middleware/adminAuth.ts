import jwt from 'jsonwebtoken';
import { query } from '../db.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-super-secret-key';

export interface AuthRequest {
  headers: Record<string, any>;
  user?: any;
}

function getUserIdFromAuthHeader(req: any): number | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    return decoded.id ?? null;
  } catch {
    return null;
  }
}

export async function requireAdmin(req: any, res: any, next: any) {
  try {
    const userId = getUserIdFromAuthHeader(req);
    if (userId === null) {
      return res.status(401).json({ error: 'Missing or invalid authorization token.' });
    }

    const userResult = await query('SELECT * FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found.' });
    }

    const user = userResult.rows[0];
    if (!user.is_admin && !user.is_class_admin) {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication error.' });
  }
}

export async function requireSuperAdmin(req: any, res: any, next: any) {
  try {
    const userId = getUserIdFromAuthHeader(req);
    if (userId === null) {
      return res.status(401).json({ error: 'Missing or invalid authorization token.' });
    }

    const userResult = await query('SELECT * FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found.' });
    }

    const user = userResult.rows[0];
    if (!user.is_admin) {
      return res.status(403).json({ error: 'Super admin access required.' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication error.' });
  }
}

export async function requireEventAdmin(req: any, res: any, next: any) {
  try {
    const userId = getUserIdFromAuthHeader(req);
    if (userId === null) {
      return res.status(401).json({ error: 'Missing or invalid authorization token.' });
    }

    const userResult = await query('SELECT * FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found.' });
    }

    const user = userResult.rows[0];

    // Super admins can manage all events
    if (user.is_admin) {
      req.user = user;
      return next();
    }

    // Class admins can only manage events for their class
    if (!user.is_class_admin) {
      return res.status(403).json({ error: 'Event admin access required.' });
    }

    // For update/delete, get class_id from the event itself
    const eventId = req.params.id;
    if (eventId) {
      const eventResult = await query('SELECT class_id FROM events WHERE id = $1', [eventId]);
      if (eventResult.rows.length === 0) {
        return res.status(404).json({ error: 'Event not found.' });
      }
      const classId = eventResult.rows[0].class_id;

      // Check if user is in this class
      const classCheck = await query(
        'SELECT id FROM class_user WHERE user_id = $1 AND class_id = $2',
        [user.id, classId]
      );

      if (classCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied. You can only manage events for your class.' });
      }
    } else {
      // For create, get class_id from request body or route params
      const class_id = req.body.class_id || req.params.classId;
      if (!class_id) {
        return res.status(400).json({ error: 'class_id is required.' });
      }

      // Check if user is in this class
      const classCheck = await query(
        'SELECT id FROM class_user WHERE user_id = $1 AND class_id = $2',
        [user.id, class_id]
      );

      if (classCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied. You can only manage events for your class.' });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Event Admin Middleware Error:', error);
    res.status(500).json({ error: 'Authentication error.' });
  }
}
