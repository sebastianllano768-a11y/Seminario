/* ═══════════════════════════════════════════════════
   SeminarIA — Evaluations Routes
   POST /api/evaluations
   GET  /api/evaluations
   GET  /api/evaluations/session/:id
   GET  /api/evaluations/analysis
   ═══════════════════════════════════════════════════ */

const express = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');

const router = express.Router();

// ═══════════════ SUBMIT EVALUATION ═══════════════
router.post('/', authenticate, async (req, res, next) => {
    try {
        const {
            session_id, rating,
            score_contenido, score_docente, score_material, score_participacion,
            fortalezas, mejoras, comentarios
        } = req.body;

        // Validation
        if (!session_id || !rating) {
            return res.status(400).json({ error: 'Sesión y calificación son requeridos' });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'La calificación debe ser entre 1 y 5' });
        }

        const scores = [score_contenido, score_docente, score_material, score_participacion];
        for (const s of scores) {
            if (s !== undefined && (s < 1 || s > 10)) {
                return res.status(400).json({ error: 'Las puntuaciones deben ser entre 1 y 10' });
            }
        }

        // Check session exists and deadline
        const sessionCheck = await pool.query('SELECT id, eval_deadline FROM sessions WHERE id = $1', [session_id]);
        if (sessionCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Sesión no encontrada' });
        }

        const session = sessionCheck.rows[0];
        if (session.eval_deadline && new Date(session.eval_deadline) < new Date()) {
            return res.status(403).json({ error: 'El plazo para evaluar esta sesión ha finalizado' });
        }

        // Check for duplicate evaluation
        const dupCheck = await pool.query(
            'SELECT id FROM evaluations WHERE user_id = $1 AND session_id = $2',
            [req.user.id, session_id]
        );
        if (dupCheck.rows.length > 0) {
            return res.status(409).json({ error: 'Ya has evaluado esta sesión' });
        }

        const result = await pool.query(
            `INSERT INTO evaluations
             (user_id, session_id, rating, score_contenido, score_docente, score_material, score_participacion, fortalezas, mejoras, comentarios)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [req.user.id, session_id, rating,
             score_contenido || 5, score_docente || 5, score_material || 5, score_participacion || 5,
             fortalezas || '', mejoras || '', comentarios || '']
        );

        res.status(201).json({
            evaluation: result.rows[0],
            message: '¡Evaluación enviada correctamente!'
        });

    } catch (err) {
        next(err);
    }
});

// ═══════════════ LIST EVALUATIONS ═══════════════
router.get('/', authenticate, async (req, res, next) => {
    try {
        let query, params;

        if (req.user.role === 'admin') {
            // Admin sees all evaluations with user info
            query = `
                SELECT e.*, u.name as user_name, u.email as user_email, s.title as session_title
                FROM evaluations e
                JOIN users u ON e.user_id = u.id
                JOIN sessions s ON e.session_id = s.id
                ORDER BY e.created_at DESC
            `;
            params = [];
        } else {
            // Students see only their own
            query = `
                SELECT e.*, s.title as session_title
                FROM evaluations e
                JOIN sessions s ON e.session_id = s.id
                WHERE e.user_id = $1
                ORDER BY e.created_at DESC
            `;
            params = [req.user.id];
        }

        const result = await pool.query(query, params);
        res.json({ evaluations: result.rows });

    } catch (err) {
        next(err);
    }
});

// ═══════════════ EVALUATIONS BY SESSION (Admin) ═══════════════
router.get('/session/:id', authenticate, requireRole('admin'), async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT e.*, u.name as user_name
             FROM evaluations e
             JOIN users u ON e.user_id = u.id
             WHERE e.session_id = $1
             ORDER BY e.created_at DESC`,
            [id]
        );

        // Compute averages
        const evaluations = result.rows;
        let stats = null;

        if (evaluations.length > 0) {
            stats = {
                count: evaluations.length,
                avg_rating: +(evaluations.reduce((a, e) => a + e.rating, 0) / evaluations.length).toFixed(2),
                avg_contenido: +(evaluations.reduce((a, e) => a + e.score_contenido, 0) / evaluations.length).toFixed(2),
                avg_docente: +(evaluations.reduce((a, e) => a + e.score_docente, 0) / evaluations.length).toFixed(2),
                avg_material: +(evaluations.reduce((a, e) => a + e.score_material, 0) / evaluations.length).toFixed(2),
                avg_participacion: +(evaluations.reduce((a, e) => a + e.score_participacion, 0) / evaluations.length).toFixed(2),
            };
        }

        res.json({ evaluations, stats });

    } catch (err) {
        next(err);
    }
});

// ═══════════════ ANALYSIS / AGGREGATED STATS (Admin) ═══════════════
router.get('/analysis', authenticate, requireRole('admin'), async (req, res, next) => {
    try {
        // Per-session averages
        const perSession = await pool.query(`
            SELECT
                s.id, s.session_number, s.title,
                COUNT(e.id)::int as eval_count,
                COALESCE(ROUND(AVG(e.rating), 2), 0) as avg_rating,
                COALESCE(ROUND(AVG(e.score_contenido), 2), 0) as avg_contenido,
                COALESCE(ROUND(AVG(e.score_docente), 2), 0) as avg_docente,
                COALESCE(ROUND(AVG(e.score_material), 2), 0) as avg_material,
                COALESCE(ROUND(AVG(e.score_participacion), 2), 0) as avg_participacion
            FROM sessions s
            LEFT JOIN evaluations e ON s.id = e.session_id
            GROUP BY s.id, s.session_number, s.title
            ORDER BY s.session_number ASC
        `);

        // Overall averages
        const overall = await pool.query(`
            SELECT
                COUNT(*)::int as total_evaluations,
                COALESCE(ROUND(AVG(rating), 2), 0) as avg_rating,
                COALESCE(ROUND(AVG(score_contenido), 2), 0) as avg_contenido,
                COALESCE(ROUND(AVG(score_docente), 2), 0) as avg_docente,
                COALESCE(ROUND(AVG(score_material), 2), 0) as avg_material,
                COALESCE(ROUND(AVG(score_participacion), 2), 0) as avg_participacion
            FROM evaluations
        `);

        res.json({
            per_session: perSession.rows,
            overall: overall.rows[0]
        });

    } catch (err) {
        next(err);
    }
});

module.exports = router;
