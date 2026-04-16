/* ═══════════════════════════════════════════════════
   SeminarIA — Auth Routes
   POST /api/auth/register
   POST /api/auth/login
   GET  /api/auth/me
   ═══════════════════════════════════════════════════ */

const express = require('express');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const { pool } = require('../config/database');
const { authenticate, generateToken } = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 12;
const googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
);

// ─── Email Validation ───
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Password Validation ───
function isValidPassword(password) {
    return typeof password === 'string' && password.length >= 6;
}

// ═══════════════ REGISTER ═══════════════
router.post('/register', async (req, res, next) => {
    try {
        const { name, email, password, role } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Formato de correo inválido' });
        }

        if (!isValidPassword(password)) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        }

        const userRole = 'estudiante';

        // Check existing user
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Este correo ya está registrado' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // Insert user
        const result = await pool.query(
            `INSERT INTO users (name, email, password_hash, role)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, email, role, created_at`,
            [name.trim(), email.toLowerCase().trim(), passwordHash, userRole]
        );

        const user = result.rows[0];
        const token = generateToken(user);

        res.status(201).json({
            message: '¡Cuenta creada exitosamente!',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                created_at: user.created_at
            }
        });

    } catch (err) {
        next(err);
    }
});

// ═══════════════ LOGIN ═══════════════
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos' });
        }

        // Find user
        const result = await pool.query(
            'SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = $1',
            [email.toLowerCase().trim()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(403).json({ error: 'Tu cuenta está desactivada. Contacta al administrador.' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = generateToken(user);

        res.json({
            message: `¡Bienvenido, ${user.name}!`,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (err) {
        next(err);
    }
});

// ═══════════════ GET CURRENT USER ═══════════════
router.get('/me', authenticate, async (req, res, next) => {
    try {
        const result = await pool.query(
            'SELECT id, name, email, role, created_at FROM users WHERE id = $1 AND is_active = TRUE',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ user: result.rows[0] });

    } catch (err) {
        next(err);
    }
});

// ═══════════════ GOOGLE OAUTH (ID Token) ═══════════════
router.post('/google', async (req, res, next) => {
    try {
        const { credential } = req.body;
        if (!credential) {
            return res.status(400).json({ error: 'Credential es requerido' });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const user = await findOrCreateGoogleUser(payload);
        const token = generateToken(user);

        res.json({
            message: `¡Bienvenido, ${user.name}!`,
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });

    } catch (err) {
        next(err);
    }
});

// ═══════════════ GOOGLE OAUTH (Authorization Code Flow) ═══════════════
router.get('/google/callback', async (req, res, next) => {
    try {
        const { code } = req.query;
        if (!code) return res.status(400).send('Missing code');

        // Exchange code for tokens
        const tokenResponse = await googleClient.getToken({
            code,
            redirect_uri: `${req.protocol}://${req.get('host')}/api/auth/google/callback`
        });

        const idToken = tokenResponse.tokens.id_token;
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const user = await findOrCreateGoogleUser(payload);
        const token = generateToken(user);

        // Save token and redirect to frontend
        res.send(`
            <html><body><script>
                localStorage.setItem('seminaria_token', '${token}');
                localStorage.setItem('seminaria_user', '${JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role })}');
                window.location.href = '/';
            </script></body></html>
        `);

    } catch (err) {
        console.error('Google callback error:', err);
        res.redirect('/?error=google_auth_failed');
    }
});

// ─── Helper: find or create user from Google payload ───
async function findOrCreateGoogleUser(payload) {
    const { email, name, picture, sub } = payload;

    let result = await pool.query(
        'SELECT id, name, email, role, is_active FROM users WHERE email = $1',
        [email.toLowerCase()]
    );

    let user;
    if (result.rows.length === 0) {
        result = await pool.query(
            `INSERT INTO users (name, email, google_id, avatar_url, role)
             VALUES ($1, $2, $3, $4, 'estudiante')
             RETURNING id, name, email, role, is_active`,
            [name, email.toLowerCase(), sub, picture || null]
        );
        user = result.rows[0];
    } else {
        user = result.rows[0];
        if (!user.google_id) {
            await pool.query(
                'UPDATE users SET google_id = $1, avatar_url = COALESCE(avatar_url, $2) WHERE id = $3',
                [sub, picture || null, user.id]
            );
        }
    }

    if (!user.is_active) {
        throw new Error('Cuenta desactivada');
    }

    return user;
}

module.exports = router;
