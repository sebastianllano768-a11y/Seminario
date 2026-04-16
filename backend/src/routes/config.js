/* ═══════════════════════════════════════════════════
   SeminarIA — Config Routes
   GET /api/config      (admin)
   PUT /api/config      (admin)
   ═══════════════════════════════════════════════════ */

const express = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');

const router = express.Router();

// ─── Get Google Client ID (public, no auth) ───
router.get('/google-client-id', (req, res) => {
    res.json({ client_id: process.env.GOOGLE_CLIENT_ID || '' });
});

// ─── Get config ───
router.get('/', authenticate, requireRole('admin'), async (req, res, next) => {
    try {
        const result = await pool.query('SELECT * FROM app_config LIMIT 1');
        res.json({ config: result.rows[0] || {} });
    } catch (err) {
        next(err);
    }
});

// ─── Update config ───
router.put('/', authenticate, requireRole('admin'), async (req, res, next) => {
    try {
        const { seminar_name, university, program, total_sessions, anonymous_eval, primary_color } = req.body;

        const result = await pool.query(
            `UPDATE app_config
             SET seminar_name = COALESCE($1, seminar_name),
                 university = COALESCE($2, university),
                 program = COALESCE($3, program),
                 total_sessions = COALESCE($4, total_sessions),
                 anonymous_eval = COALESCE($5, anonymous_eval),
                 primary_color = COALESCE($6, primary_color)
             WHERE id = 1
             RETURNING *`,
            [seminar_name, university, program, total_sessions, anonymous_eval, primary_color]
        );

        res.json({ config: result.rows[0], message: 'Configuración actualizada' });

    } catch (err) {
        next(err);
    }
});

module.exports = router;
