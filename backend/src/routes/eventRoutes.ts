import express from 'express';
import { query } from '../db.ts';

const router = express.Router();

// GET /api/classes/:classId/events - Get upcoming events for a class
router.get('/class/:classId/events', async (req, res) => {
  const { classId } = req.params;

  try {
    // Verify class exists
    const classCheck = await query('SELECT id FROM classes WHERE id = $1', [classId]);
    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found.' });
    }

    const result = await query(
      `SELECT id, event_name, event_date, event_time, location, description
       FROM events
       WHERE class_id = $1 AND event_date >= CURRENT_DATE
       ORDER BY event_date ASC, event_time ASC`,
      [classId]
    );

    res.status(200).json({ events: result.rows });
  } catch (error) {
    console.error('Get Events Error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/events/:eventId - Get single event
router.get('/:eventId', async (req, res) => {
  const { eventId } = req.params;

  try {
    const result = await query(
      `SELECT id, class_id, event_name, event_date, event_time, location, description, created_at, updated_at
       FROM events
       WHERE id = $1`,
      [eventId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    res.status(200).json({ event: result.rows[0] });
  } catch (error) {
    console.error('Get Event Error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/events/class/:classId/days-until-next
router.get('/class/:classId/days-until-next', async (req, res) => {
  const { classId } = req.params;

  try {
    // Get the next event (including today)
    const result = await query(
      `SELECT event_date FROM events
       WHERE class_id = $1 AND event_date >= CURRENT_DATE
       ORDER BY event_date ASC
       LIMIT 1`,
      [classId]
    );

    if (result.rows.length === 0) {
      // No upcoming events
      return res.status(200).json({ daysUntil: null, eventDate: null });
    }

    const eventDate = new Date(result.rows[0].event_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));

    res.status(200).json({ daysUntil, eventDate: result.rows[0].event_date });
  } catch (error) {
    console.error('Get Days Until Next Event Error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export { router as eventRoutes };


