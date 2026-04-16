/* ═══════════════════════════════════════════════════
   SeminarIA — Role-Based Access Control Middleware
   ═══════════════════════════════════════════════════ */

/**
 * Middleware factory: Require specific role(s)
 * Usage: requireRole('admin'), requireRole('admin', 'estudiante')
 *
 * Must be used AFTER authenticate middleware
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'No tienes permisos para realizar esta acción'
            });
        }

        next();
    };
}

module.exports = { requireRole };
