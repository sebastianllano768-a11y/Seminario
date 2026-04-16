/* ═══════════════════════════════════════════════════
   SeminarIA — JWT Authentication Middleware
   ═══════════════════════════════════════════════════ */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-me';

/**
 * Middleware: Verify JWT token from Authorization header
 * Attaches decoded user to req.user
 */
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    // Support token via query param (for file downloads)
    const token = (authHeader && authHeader.startsWith('Bearer '))
        ? authHeader.split(' ')[1]
        : req.query.token;

    if (!token) {
        return res.status(401).json({ error: 'Token de autenticación requerido' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id, email, role }
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expirado, inicia sesión de nuevo' });
        }
        return res.status(401).json({ error: 'Token inválido' });
    }
}

/**
 * Generate a JWT token for a user
 */
function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role, name: user.name },
        JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
}

module.exports = { authenticate, generateToken };
