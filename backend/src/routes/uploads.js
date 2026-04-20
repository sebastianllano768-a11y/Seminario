/* ═══════════════════════════════════════════════════
   SeminarIA — File Upload Routes
   POST /api/uploads
   GET  /api/uploads
   PUT  /api/uploads/:id/status  (admin)
   ═══════════════════════════════════════════════════ */

const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');

const router = express.Router();

const os = require('os');
const fs = require('fs');

// ─── Multer Config ───
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const ALLOWED_MIMETYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
];

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV || __dirname.includes('/var/task');
        if (isVercel) {
            cb(null, os.tmpdir());
        } else {
            const uploadPath = path.join(__dirname, '../../uploads');
            if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
            cb(null, uploadPath);
        }
    },
    filename: (req, file, cb) => {
        // Generate secure unique filename
        const uniqueId = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${uniqueId}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Formato no soportado. Usa PDF, DOCX o PPTX'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_FILE_SIZE }
});

// ═══════════════ UPLOAD FILE ═══════════════
router.post('/', authenticate, (req, res, next) => {
    upload.single('file')(req, res, async (err) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'El archivo excede el límite de 25MB' });
                }
                return res.status(400).json({ error: err.message });
            }
            return res.status(400).json({ error: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No se recibió ningún archivo' });
        }

        try {
            const result = await pool.query(
                `INSERT INTO uploads (user_id, filename, original_name, mimetype, size_bytes)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [req.user.id, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size]
            );

            res.status(201).json({
                upload: result.rows[0],
                message: `"${req.file.originalname}" subido correctamente`
            });

        } catch (dbErr) {
            next(dbErr);
        }
    });
});

// ═══════════════ LIST UPLOADS ═══════════════
router.get('/', authenticate, async (req, res, next) => {
    try {
        let query, params;

        if (req.user.role === 'admin') {
            query = `
                SELECT up.*, u.name as user_name, u.email as user_email
                FROM uploads up
                JOIN users u ON up.user_id = u.id
                ORDER BY up.created_at DESC
            `;
            params = [];
        } else {
            query = `
                SELECT * FROM uploads
                WHERE user_id = $1
                ORDER BY created_at DESC
            `;
            params = [req.user.id];
        }

        const result = await pool.query(query, params);
        res.json({ uploads: result.rows });

    } catch (err) {
        next(err);
    }
});

// ═══════════════ UPDATE UPLOAD STATUS (Admin) ═══════════════
router.put('/:id/status', authenticate, requireRole('admin'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatus = ['en_revision', 'aprobado', 'rechazado'];
        if (!validStatus.includes(status)) {
            return res.status(400).json({ error: 'Estado inválido. Usar: en_revision, aprobado, rechazado' });
        }

        const result = await pool.query(
            'UPDATE uploads SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }

        res.json({ upload: result.rows[0], message: 'Estado actualizado' });

    } catch (err) {
        next(err);
    }
});

module.exports = router;
