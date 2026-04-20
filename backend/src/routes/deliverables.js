/* ═══════════════════════════════════════════════════
   SeminarIA — Deliverables Routes
   GET    /api/deliverables              (all, filtered by role)
   POST   /api/deliverables              (admin: create)
   PUT    /api/deliverables/:id          (admin: update)
   DELETE /api/deliverables/:id          (admin: delete)
   GET    /api/deliverables/:id/status   (admin: submission stats)
   POST   /api/deliverables/:id/submit   (student: submit file)
   --- Parameters ---
   POST   /api/deliverables/:id/parameters       (admin: add parameter)
   GET    /api/deliverables/:id/parameters        (get parameters)
   DELETE /api/deliverables/parameters/:paramId   (admin: delete parameter)
   --- Feedback ---
   GET    /api/deliverables/submission/:subId/feedback  (student/admin: get AI feedback)
   GET    /api/deliverables/:id/feedback-history        (admin: all feedback for a deliverable)
   ═══════════════════════════════════════════════════ */

const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');
const { extractText } = require('../services/textExtractor');
const groqAI = require('../services/groqAI');

const router = express.Router();

// File upload config
// Use memory storage — avoids EROFS on Vercel serverless (read-only filesystem)
// After upload, the buffer is written manually to os.tmpdir()
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
    fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.docx', '.doc', '.pptx', '.ppt', '.xlsx', '.xls'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Formato de archivo no permitido'));
        }
    }
});

/**
 * Saves an uploaded file buffer to /tmp and returns the saved path.
 */
function saveTempFile(buffer, filename) {
    const tmpPath = path.join(os.tmpdir(), filename);
    fs.writeFileSync(tmpPath, buffer);
    return tmpPath;
}

// ─── List deliverables ───
router.get('/', authenticate, async (req, res, next) => {
    try {
        let result;
        if (req.user.role === 'admin') {
            // Admin sees all deliverables with submission counts
            result = await pool.query(`
                SELECT d.*,
                    (SELECT COUNT(*) FROM deliverable_submissions ds WHERE ds.deliverable_id = d.id)::int AS total_submissions,
                    (SELECT COUNT(*) FROM deliverable_submissions ds WHERE ds.deliverable_id = d.id AND ds.is_late = false)::int AS on_time,
                    (SELECT COUNT(*) FROM deliverable_submissions ds WHERE ds.deliverable_id = d.id AND ds.is_late = true)::int AS late,
                    (SELECT COUNT(*) FROM deliverable_parameters dp WHERE dp.deliverable_id = d.id)::int AS param_count
                FROM deliverables d
                ORDER BY d.created_at DESC
            `);
        } else {
            // Students see active deliverables with their submission status + AI feedback status
            result = await pool.query(`
                SELECT d.*,
                    ds.id AS submission_id,
                    ds.original_name AS submitted_file,
                    ds.submitted_at,
                    ds.is_late,
                    sas.overall_score,
                    sas.status AS ai_status,
                    ds.attempt_number,
                    (SELECT COUNT(*) FROM deliverable_submissions dsc WHERE dsc.deliverable_id = d.id AND dsc.user_id = $1) AS total_attempts
                FROM deliverables d
                LEFT JOIN deliverable_submissions ds ON ds.deliverable_id = d.id AND ds.user_id = $1 AND ds.is_deleted = false
                LEFT JOIN submission_ai_summary sas ON sas.submission_id = ds.id
                WHERE d.is_active = true
                ORDER BY d.deadline ASC
            `, [req.user.id]);
        }
        res.json({ deliverables: result.rows });
    } catch (err) {
        next(err);
    }
});

// ─── Create deliverable (admin) ───
router.post('/', authenticate, requireRole('admin'), async (req, res, next) => {
    try {
        const { title, description, deadline, ai_prompt, parameters } = req.body;

        if (!title || !deadline) {
            return res.status(400).json({ error: 'Título y fecha límite son requeridos' });
        }

        const result = await pool.query(
            `INSERT INTO deliverables (title, description, deadline, ai_prompt)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [title.trim(), description || '', deadline, ai_prompt || null]
        );

        const deliverable = result.rows[0];

        // If parameters were sent with creation, add them
        if (parameters && Array.isArray(parameters) && parameters.length > 0) {
            for (let i = 0; i < parameters.length; i++) {
                const p = parameters[i];
                if (p.name && p.description) {
                    await pool.query(
                        `INSERT INTO deliverable_parameters (deliverable_id, name, description, weight, sort_order)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [deliverable.id, p.name.trim(), p.description.trim(), p.weight || 1, i]
                    );
                }
            }
        }

        res.status(201).json({ deliverable, message: 'Entrega creada exitosamente' });
    } catch (err) {
        next(err);
    }
});

// ─── Update deliverable (admin) ───
router.put('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, description, deadline, is_active, ai_prompt } = req.body;

        const result = await pool.query(
            `UPDATE deliverables
             SET title = COALESCE($1, title),
                 description = COALESCE($2, description),
                 deadline = COALESCE($3, deadline),
                 is_active = COALESCE($4, is_active),
                 ai_prompt = CASE WHEN $5::text IS NOT NULL THEN $5 ELSE ai_prompt END
             WHERE id = $6
             RETURNING *`,
            [title, description, deadline, is_active, ai_prompt !== undefined ? (ai_prompt || null) : null, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Entrega no encontrada' });
        }

        res.json({ deliverable: result.rows[0], message: 'Entrega actualizada' });
    } catch (err) {
        next(err);
    }
});

// ─── Delete deliverable (admin) ───
router.delete('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM deliverables WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Entrega no encontrada' });
        }

        res.json({ message: 'Entrega eliminada exitosamente' });
    } catch (err) {
        next(err);
    }
});

// ─── Submission status for a deliverable (admin) ───
router.get('/:id/status', authenticate, requireRole('admin'), async (req, res, next) => {
    try {
        const { id } = req.params;

        const deliverable = await pool.query('SELECT * FROM deliverables WHERE id = $1', [id]);
        if (deliverable.rows.length === 0) {
            return res.status(404).json({ error: 'Entrega no encontrada' });
        }

        const submissions = await pool.query(`
            SELECT ds.*, u.name AS user_name, u.email AS user_email,
                   sas.overall_score, sas.status AS ai_status
            FROM deliverable_submissions ds
            JOIN users u ON ds.user_id = u.id
            LEFT JOIN submission_ai_summary sas ON sas.submission_id = ds.id
            WHERE ds.deliverable_id = $1 AND ds.is_deleted = false
            ORDER BY ds.submitted_at ASC
        `, [id]);

        const totalStudents = await pool.query(
            "SELECT COUNT(*)::int AS count FROM users WHERE role = 'estudiante' AND is_active = true"
        );

        res.json({
            deliverable: deliverable.rows[0],
            submissions: submissions.rows,
            total_students: totalStudents.rows[0].count,
            submitted: submissions.rows.length,
            missing: totalStudents.rows[0].count - submissions.rows.length
        });
    } catch (err) {
        next(err);
    }
});

// ─── Download a submission file (admin) ───
router.get('/submission/:subId/download', authenticate, requireRole('admin'), async (req, res, next) => {
    try {
        const result = await pool.query('SELECT filename, original_name, mimetype FROM deliverable_submissions WHERE id = $1', [req.params.subId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Archivo no encontrado' });

        const sub = result.rows[0];
        // File is always in /tmp (memoryStorage writes there)
        const filePath = path.join(os.tmpdir(), sub.filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'El archivo ya no está disponible en el servidor (almacenamiento temporal limpio).' });
        }
        res.setHeader('Content-Disposition', `attachment; filename="${sub.original_name}"`);
        res.setHeader('Content-Type', sub.mimetype || 'application/octet-stream');
        res.sendFile(filePath);
    } catch (err) {
        next(err);
    }
});

// ─── Submit file for a deliverable (student) ───
router.post('/:id/submit', authenticate, upload.single('file'), async (req, res, next) => {
    try {
        const { id } = req.params;

        // Check deliverable exists and is active
        const delCheck = await pool.query('SELECT * FROM deliverables WHERE id = $1 AND is_active = true', [id]);
        if (delCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Entrega no encontrada o no está activa' });
        }

        const deliverable = delCheck.rows[0];

        // Check if there's already an active submission
        const activeCheck = await pool.query(
            'SELECT id FROM deliverable_submissions WHERE deliverable_id = $1 AND user_id = $2 AND is_deleted = false',
            [id, req.user.id]
        );
        if (activeCheck.rows.length > 0) {
            return res.status(409).json({ error: 'Ya tienes una entrega activa. Elimínala primero para volver a subir.' });
        }

        // Count total attempts (for tracking, no longer limited)
        const attemptsCheck = await pool.query(
            'SELECT COUNT(*) AS total_attempts FROM deliverable_submissions WHERE deliverable_id = $1 AND user_id = $2',
            [id, req.user.id]
        );
        const totalAttempts = parseInt(attemptsCheck.rows[0].total_attempts);

        if (!req.file) {
            return res.status(400).json({ error: 'Debes adjuntar un archivo' });
        }

        // Save file buffer to /tmp (works on Vercel and local)
        const uniqueName = `del_${Date.now()}_${Math.round(Math.random() * 1e6)}${path.extname(req.file.originalname)}`;
        saveTempFile(req.file.buffer, uniqueName);

        // Use the generated name and the buffer size
        const savedFilename = uniqueName;
        const savedSize = req.file.buffer.length;

        // Check if late
        const isLate = new Date() > new Date(deliverable.deadline);

        const result = await pool.query(
            `INSERT INTO deliverable_submissions
             (deliverable_id, user_id, filename, original_name, mimetype, size_bytes, is_late, attempt_number)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [id, req.user.id, savedFilename, req.file.originalname, req.file.mimetype, savedSize, isLate, totalAttempts + 1]
        );

        const submission = result.rows[0];

        // Trigger AI evaluation in background (don't block response)
        triggerAIEvaluation(submission.id, parseInt(id), savedFilename, req.file.originalname);

        res.status(201).json({
            submission,
            message: isLate
                ? 'Entrega recibida (con retraso). Pronto tendrás los resultados de tu retroalimentación.'
                : '¡Entrega recibida a tiempo! Pronto tendrás los resultados de tu retroalimentación.'
        });
    } catch (err) {
        next(err);
    }
});

// ─── Delete a submission (mark as deleted) (student) ───
router.delete('/submission/:subId', authenticate, async (req, res, next) => {
    try {
        // Can only delete if it belongs to the user and is not already deleted
        const result = await pool.query(
            `UPDATE deliverable_submissions 
             SET is_deleted = true 
             WHERE id = $1 AND user_id = $2 AND is_deleted = false
             RETURNING deliverable_id`,
            [req.params.subId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'La entrega no existe, no tienes permiso o ya fue eliminada.' });
        }

        res.json({ message: 'Entrega en papelera. Puedes volver a subir una nueva versión.' });
    } catch (err) {
        next(err);
    }
});

/**
 * Background AI evaluation trigger
 */
async function triggerAIEvaluation(submissionId, deliverableId, filename, originalName) {
    try {
        if (!groqAI.isAvailable()) {
            console.log('⚠️ GROQ_API_KEY not set, skipping AI evaluation');
            return;
        }

        // Mark as pending
        await pool.query(
            `INSERT INTO submission_ai_summary (submission_id, status) VALUES ($1, 'pending')
             ON CONFLICT (submission_id) DO UPDATE SET status = 'pending'`,
            [submissionId]
        );

        // Extract text from file
        // File is always in /tmp (memoryStorage writes there)
        const localPath = path.join(__dirname, '../../uploads', filename);
        const tmpPath = path.join(os.tmpdir(), filename);
        const filePath = fs.existsSync(localPath) ? localPath : tmpPath;
        const ext = path.extname(originalName).toLowerCase();

        let content = '';
        if (['.pdf', '.docx', '.doc'].includes(ext)) {
            content = await extractText(filePath, originalName);
        }

        if (!content || content.trim().length < 20) {
            await pool.query(
                `UPDATE submission_ai_summary SET status = 'error', overall_summary = 'No se pudo extraer texto suficiente del archivo' WHERE submission_id = $1`,
                [submissionId]
            );
            return;
        }

        // Run evaluation
        await groqAI.evaluateSubmission({ pool, submissionId, deliverableId, content });

    } catch (err) {
        console.error('❌ Background AI evaluation error:', err.message);
    }
}

// ════════════════════════════════════════════════════
// PARAMETERS CRUD
// ════════════════════════════════════════════════════

// ─── Add parameter to a deliverable ───
router.post('/:id/parameters', authenticate, requireRole('admin'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, weight } = req.body;

        if (!name || !description) {
            return res.status(400).json({ error: 'Nombre y descripción del parámetro son requeridos' });
        }

        // Get next sort order
        const orderResult = await pool.query(
            'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM deliverable_parameters WHERE deliverable_id = $1',
            [id]
        );

        const result = await pool.query(
            `INSERT INTO deliverable_parameters (deliverable_id, name, description, weight, sort_order)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [id, name.trim(), description.trim(), weight || 1, orderResult.rows[0].next_order]
        );

        res.status(201).json({ parameter: result.rows[0], message: 'Parámetro agregado' });
    } catch (err) {
        next(err);
    }
});

// ─── Get parameters for a deliverable ───
router.get('/:id/parameters', authenticate, async (req, res, next) => {
    try {
        const result = await pool.query(
            'SELECT * FROM deliverable_parameters WHERE deliverable_id = $1 ORDER BY sort_order',
            [req.params.id]
        );
        res.json({ parameters: result.rows });
    } catch (err) {
        next(err);
    }
});

// ─── Delete a parameter ───
router.delete('/parameters/:paramId', authenticate, requireRole('admin'), async (req, res, next) => {
    try {
        const result = await pool.query(
            'DELETE FROM deliverable_parameters WHERE id = $1 RETURNING id',
            [req.params.paramId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Parámetro no encontrado' });
        }
        res.json({ message: 'Parámetro eliminado' });
    } catch (err) {
        next(err);
    }
});

// ════════════════════════════════════════════════════
// AI FEEDBACK ENDPOINTS
// ════════════════════════════════════════════════════

// ─── Get AI feedback for a specific submission ───
router.get('/submission/:subId/feedback', authenticate, async (req, res, next) => {
    try {
        const { subId } = req.params;

        // Check access: student can only see their own, admin can see all
        if (req.user.role !== 'admin') {
            const ownerCheck = await pool.query(
                'SELECT id FROM deliverable_submissions WHERE id = $1 AND user_id = $2',
                [subId, req.user.id]
            );
            if (ownerCheck.rows.length === 0) {
                return res.status(403).json({ error: 'No tienes acceso a esta retroalimentación' });
            }
        }

        // Get summary
        const summary = await pool.query(
            'SELECT * FROM submission_ai_summary WHERE submission_id = $1',
            [subId]
        );

        // Get per-parameter feedback
        const feedback = await pool.query(`
            SELECT sf.*, dp.name AS parameter_name, dp.description AS parameter_description
            FROM submission_feedback sf
            JOIN deliverable_parameters dp ON sf.parameter_id = dp.id
            WHERE sf.submission_id = $1
            ORDER BY dp.sort_order
        `, [subId]);

        res.json({
            summary: summary.rows[0] || null,
            feedback: feedback.rows
        });
    } catch (err) {
        next(err);
    }
});

// ─── Get all feedback for a deliverable (admin: per-student history) ───
router.get('/:id/feedback-history', authenticate, requireRole('admin'), async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT ds.id AS submission_id, ds.submitted_at, ds.is_late, ds.original_name, ds.attempt_number, ds.is_deleted,
                   u.id AS user_id, u.name AS user_name, u.email AS user_email,
                   sas.overall_score, sas.overall_summary, sas.status AS ai_status, sas.evaluated_at
            FROM deliverable_submissions ds
            JOIN users u ON ds.user_id = u.id
            LEFT JOIN submission_ai_summary sas ON sas.submission_id = ds.id
            WHERE ds.deliverable_id = $1
            ORDER BY u.name ASC, ds.attempt_number ASC
        `, [id]);

        res.json({ submissions: result.rows });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
