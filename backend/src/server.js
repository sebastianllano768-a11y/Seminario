/* ═══════════════════════════════════════════════════
   Seminario de Investigación 2 — Express Server Entry Point
   ═══════════════════════════════════════════════════ */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { pool, testConnection } = require('./config/database');
const { seedAdmin } = require('./utils/seed');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust Vercel's proxy so req.protocol returns 'https' correctly
app.set('trust proxy', 1);

// ═══════════════ SECURITY MIDDLEWARE ═══════════════

// Helmet: HTTP security headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false // Allow CDN resources in frontend
}));

// CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['*'];

app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? (origin, callback) => {
            // Allow requests with no origin (mobile apps, curl, etc.)
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes('*') || allowedOrigins.some(o => origin.includes(o))) {
                return callback(null, true);
            }
            callback(new Error('CORS not allowed'));
        }
        : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting — anti-abuse
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // max 200 requests per windowMs
    message: { error: 'Demasiadas solicitudes, intenta más tarde.' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', limiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Demasiados intentos de autenticación, intenta más tarde.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/google', authLimiter);

// ═══════════════ BODY PARSING ═══════════════
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ═══════════════ STATIC FILES ═══════════════
// Serve frontend
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

// Serve uploaded files (protected by auth in routes)
app.use('/api/uploads/files', express.static(path.join(__dirname, '..', 'uploads')));

// ═══════════════ HEALTH CHECK ═══════════════
app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({
            status: 'ok',
            timestamp: result.rows[0].now,
            service: 'Seminario de Investigación 2 API',
            version: '1.0.0'
        });
    } catch (err) {
        res.status(503).json({
            status: 'error',
            message: 'Database connection failed'
        });
    }
});

// ═══════════════ API ROUTES ═══════════════
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/sessions',    require('./routes/sessions'));
app.use('/api/evaluations', require('./routes/evaluations'));
app.use('/api/suggestions', require('./routes/suggestions'));
app.use('/api/uploads',       require('./routes/uploads'));
app.use('/api/deliverables', require('./routes/deliverables'));
app.use('/api/dashboard',    require('./routes/dashboard'));
app.use('/api/config',      require('./routes/config'));

// ═══════════════ 404 HANDLER ═══════════════
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'Endpoint no encontrado' });
});

// ═══════════════ ERROR HANDLER ═══════════════
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.message);
    console.error(err.stack);

    // Don't leak internal errors in production
    const message = process.env.NODE_ENV === 'production'
        ? 'Error interno del servidor'
        : err.message;

    res.status(err.status || 500).json({
        error: message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

// ═══════════════ START SERVER ═══════════════
async function start() {
    try {
        // Test database connection
        await testConnection();
        console.log('✅ PostgreSQL connected');

        // Seed admin user if not exists
        await seedAdmin();

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`\n🚀 Seminario de Investigación 2 API running on port ${PORT}`);
            console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
            console.log(`🔐 Environment: ${process.env.NODE_ENV || 'development'}\n`);
        });
    } catch (err) {
        console.error('❌ Failed to start server:', err.message);
        process.exit(1);
    }
}

// Only start the server when NOT running as a Vercel serverless function
if (!process.env.VERCEL) {
    start();
}

// Export for Vercel serverless
module.exports = app;
