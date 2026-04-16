/* ═══════════════════════════════════════════════════
   SeminarIA — Dashboard Routes
   GET /api/dashboard
   ═══════════════════════════════════════════════════ */

const express = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ═══════════════ DASHBOARD METRICS ═══════════════
router.get('/', authenticate, async (req, res, next) => {
    try {
        if (req.user.role === 'admin') {
            // ─── Admin Dashboard ───
            const [sessionsRes, evalsRes, satisfactionRes, suggestionsRes, activityRes] = await Promise.all([
                // Completed sessions count
                pool.query("SELECT COUNT(*)::int as count FROM sessions WHERE status = 'completada'"),

                // Total evaluations
                pool.query('SELECT COUNT(*)::int as count FROM evaluations'),

                // Average satisfaction (rating out of 5 → percentage)
                pool.query('SELECT COALESCE(ROUND(AVG(rating) / 5.0 * 100), 0)::int as percentage FROM evaluations'),

                // Active suggestions count
                pool.query('SELECT COUNT(*)::int as count FROM suggestions'),

                // Recent activity (last 10 events)
                pool.query(`
                    (
                        SELECT 'evaluation' as type, 
                               'Evaluación de "' || s.title || '"' as title,
                               u.name as actor,
                               e.created_at as date
                        FROM evaluations e
                        JOIN users u ON e.user_id = u.id
                        JOIN sessions s ON e.session_id = s.id
                        ORDER BY e.created_at DESC LIMIT 5
                    )
                    UNION ALL
                    (
                        SELECT 'suggestion' as type,
                               LEFT(sg.content, 60) || '...' as title,
                               CASE WHEN sg.is_anonymous THEN 'Anónimo' ELSE u.name END as actor,
                               sg.created_at as date
                        FROM suggestions sg
                        JOIN users u ON sg.user_id = u.id
                        ORDER BY sg.created_at DESC LIMIT 5
                    )
                    ORDER BY date DESC LIMIT 10
                `)
            ]);

            res.json({
                metrics: {
                    sessions_completed: sessionsRes.rows[0].count,
                    total_evaluations: evalsRes.rows[0].count,
                    satisfaction_percentage: satisfactionRes.rows[0].percentage,
                    active_suggestions: suggestionsRes.rows[0].count
                },
                activity: activityRes.rows
            });

        } else {
            // ─── Student Dashboard ───
            const [evalsRes, suggestionsRes, uploadsRes, pendingRes] = await Promise.all([
                // Evaluations sent by user
                pool.query('SELECT COUNT(*)::int as count FROM evaluations WHERE user_id = $1', [req.user.id]),

                // Suggestions by user
                pool.query('SELECT COUNT(*)::int as count FROM suggestions WHERE user_id = $1', [req.user.id]),

                // Uploads by user
                pool.query('SELECT COUNT(*)::int as count FROM uploads WHERE user_id = $1', [req.user.id]),

                // Pending sessions (not yet evaluated by user)
                pool.query(`
                    SELECT COUNT(*)::int as count FROM sessions s
                    WHERE s.status = 'completada'
                    AND NOT EXISTS (
                        SELECT 1 FROM evaluations e
                        WHERE e.session_id = s.id AND e.user_id = $1
                    )
                `, [req.user.id])
            ]);

            res.json({
                metrics: {
                    evaluations_sent: evalsRes.rows[0].count,
                    suggestions_made: suggestionsRes.rows[0].count,
                    files_uploaded: uploadsRes.rows[0].count,
                    pending_sessions: pendingRes.rows[0].count
                }
            });
        }

    } catch (err) {
        next(err);
    }
});

module.exports = router;
