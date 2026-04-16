/* ═══════════════════════════════════════════════════
   SeminarIA — Suggestions Routes
   GET  /api/suggestions
   POST /api/suggestions
   POST /api/suggestions/:id/vote
   ═══════════════════════════════════════════════════ */

const express = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ═══════════════ LIST SUGGESTIONS ═══════════════
router.get('/', authenticate, async (req, res, next) => {
    try {
        const isAdmin = req.user.role === 'admin';

        // Get config to check anonymous mode
        const configResult = await pool.query('SELECT anonymous_eval FROM app_config LIMIT 1');
        const isAnonymous = configResult.rows[0]?.anonymous_eval ?? true;

        // Admin sees all suggestions; students see only their own
        const whereClause = isAdmin ? '' : 'WHERE s.user_id = $1';

        const result = await pool.query(`
            SELECT
                s.id, s.category, s.content, s.is_anonymous, s.created_at,
                ${isAnonymous && isAdmin ? "'Anónimo' as author_name" : 'u.name as author_name'},
                u.id as author_id,
                COALESCE(v.vote_count, 0)::int as votes,
                EXISTS(
                    SELECT 1 FROM suggestion_votes sv
                    WHERE sv.suggestion_id = s.id AND sv.user_id = $1
                ) as user_voted
            FROM suggestions s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN (
                SELECT suggestion_id, COUNT(*) as vote_count
                FROM suggestion_votes
                GROUP BY suggestion_id
            ) v ON s.id = v.suggestion_id
            ${whereClause}
            ORDER BY votes DESC, s.created_at DESC
        `, [req.user.id]);

        res.json({ suggestions: result.rows });

    } catch (err) {
        next(err);
    }
});

// ═══════════════ CREATE SUGGESTION ═══════════════
router.post('/', authenticate, async (req, res, next) => {
    try {
        const { category, content } = req.body;

        if (!content || content.trim().length < 5) {
            return res.status(400).json({ error: 'La sugerencia debe tener al menos 5 caracteres' });
        }

        const validCategories = ['contenido', 'metodologia', 'recursos', 'organizacion', 'otro'];
        const cat = validCategories.includes(category) ? category : 'otro';

        const result = await pool.query(
            `INSERT INTO suggestions (user_id, category, content, is_anonymous)
             VALUES ($1, $2, $3, TRUE)
             RETURNING *`,
            [req.user.id, cat, content.trim()]
        );

        res.status(201).json({
            suggestion: result.rows[0],
            message: '¡Sugerencia enviada correctamente!'
        });

    } catch (err) {
        next(err);
    }
});

// ═══════════════ VOTE / UNVOTE ═══════════════
router.post('/:id/vote', authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;

        // Check suggestion exists
        const sugCheck = await pool.query('SELECT id FROM suggestions WHERE id = $1', [id]);
        if (sugCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Sugerencia no encontrada' });
        }

        // Toggle vote
        const existing = await pool.query(
            'SELECT id FROM suggestion_votes WHERE suggestion_id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        let action;
        if (existing.rows.length > 0) {
            // Remove vote
            await pool.query(
                'DELETE FROM suggestion_votes WHERE suggestion_id = $1 AND user_id = $2',
                [id, req.user.id]
            );
            action = 'removed';
        } else {
            // Add vote
            await pool.query(
                'INSERT INTO suggestion_votes (suggestion_id, user_id) VALUES ($1, $2)',
                [id, req.user.id]
            );
            action = 'added';
        }

        // Get updated count
        const countResult = await pool.query(
            'SELECT COUNT(*)::int as votes FROM suggestion_votes WHERE suggestion_id = $1',
            [id]
        );

        res.json({
            votes: countResult.rows[0].votes,
            action,
            message: action === 'added' ? '¡Voto registrado!' : 'Voto eliminado'
        });

    } catch (err) {
        next(err);
    }
});

// ═══════════════ DELETE OWN SUGGESTION (Student) ═══════════════
router.delete('/:id', authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;

        // Students can only delete their own; admin can delete any
        const whereClause = req.user.role === 'admin'
            ? 'WHERE id = $1'
            : 'WHERE id = $1 AND user_id = $2';
        const params = req.user.role === 'admin' ? [id] : [id, req.user.id];

        const result = await pool.query(`DELETE FROM suggestions ${whereClause} RETURNING id`, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Sugerencia no encontrada o no tienes permiso' });
        }

        res.json({ message: 'Sugerencia eliminada' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
