/* ═══════════════════════════════════════════════════
   SeminarIA — Sessions Routes
   GET    /api/sessions         (all, filtered by role)
   POST   /api/sessions         (admin)
   PUT    /api/sessions/:id     (admin)
   DELETE /api/sessions/:id     (admin)
   ═══════════════════════════════════════════════════ */

const express = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');

const router = express.Router();

// ─── List sessions ───
// Admin: sees all sessions
// Student: sees only sessions with eval_deadline in the future (open for evaluation)
router.get('/', authenticate, async (req, res, next) => {
    try {
        let result;
        if (req.user.role === 'admin') {
            result = await pool.query(
                'SELECT * FROM sessions ORDER BY session_number ASC'
            );
        } else {
            // Students see sessions that have a deadline set and are still open
            result = await pool.query(
                `SELECT * FROM sessions
                 WHERE eval_deadline IS NOT NULL AND eval_deadline > NOW()
                 ORDER BY session_number ASC`
            );
        }
        res.json({ sessions: result.rows });
    } catch (err) {
        next(err);
    }
});

// ─── Create session (admin only) ───
router.post('/', authenticate, requireRole('admin'), async (req, res, next) => {
    try {
        const { title, description, session_date, eval_deadline } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'El título de la sesión es requerido' });
        }

        // Auto-assign session_number
        const countResult = await pool.query('SELECT COALESCE(MAX(session_number), 0) + 1 AS next_num FROM sessions');
        const session_number = countResult.rows[0].next_num;

        const result = await pool.query(
            `INSERT INTO sessions (session_number, title, description, status, session_date, eval_deadline)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [session_number, title.trim(), description || '', 'pendiente', session_date || null, eval_deadline || null]
        );

        res.status(201).json({ session: result.rows[0], message: 'Sesión creada exitosamente' });
    } catch (err) {
        next(err);
    }
});

// ─── Update session (admin only) ───
router.put('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, description, status, session_date, eval_deadline } = req.body;

        const result = await pool.query(
            `UPDATE sessions
             SET title = COALESCE($1, title),
                 description = COALESCE($2, description),
                 status = COALESCE($3, status),
                 session_date = COALESCE($4, session_date),
                 eval_deadline = COALESCE($5, eval_deadline)
             WHERE id = $6
             RETURNING *`,
            [title, description, status, session_date, eval_deadline, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Sesión no encontrada' });
        }

        res.json({ session: result.rows[0], message: 'Sesión actualizada' });
    } catch (err) {
        next(err);
    }
});

// ─── Delete session (admin only) ───
router.delete('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM sessions WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Sesión no encontrada' });
        }

        res.json({ message: 'Sesión eliminada exitosamente' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
