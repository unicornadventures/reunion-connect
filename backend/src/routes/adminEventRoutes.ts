import express from 'express';
import { query } from '../db.ts';
import { requireEventAdmin, requireSuperAdmin } from '../middleware/adminAuth.ts';

const router = express.Router();

// POST /api/admin/events - Create event (super admin or class admin)
router.post('/', requireEventAdmin, async (req: any, res) => {
  const { class_id, event_name, event_date, event_time, location, description } = req.body;

  if (!class_id || !event_name || !event_date || !event_time || !location) {
    return res.status(400).json({ error: 'Missing required fields: class_id, event_name, event_date, event_time, location.' });
  }

  try {
    // Verify class exists
    const classCheck = await query('SELECT id FROM classes WHERE id = $1', [class_id]);
    if (classCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Class not found.' });
    }

    const result = await query(
      `INSERT INTO events (class_id, event_name, event_date, event_time, location, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [class_id, event_name, event_date, event_time, location, description || null]
    );

    res.status(201).json({ event: result.rows[0] });
  } catch (error) {
    console.error('Admin Create Event Error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/admin/events/:id - Update event (super admin or class admin)
router.put('/:id', requireEventAdmin, async (req: any, res) => {
  const { id } = req.params;
  const { event_name, event_date, event_time, location, description } = req.body;

  if (!event_name || !event_date || !event_time || !location) {
    return res.status(400).json({ error: 'Missing required fields: event_name, event_date, event_time, location.' });
  }

  try {
    const result = await query(
      `UPDATE events
       SET event_name = $1, event_date = $2, event_time = $3, location = $4, description = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [event_name, event_date, event_time, location, description || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    res.status(200).json({ event: result.rows[0] });
  } catch (error) {
    console.error('Admin Update Event Error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/admin/events/:id - Delete event (super admin or class admin)
router.delete('/:id', requireEventAdmin, async (req: any, res) => {
  const { id } = req.params;

  try {
    const result = await query('DELETE FROM events WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    res.status(200).json({ message: 'Event deleted successfully.' });
  } catch (error) {
    console.error('Admin Delete Event Error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export { router as adminEventRoutes };
