/* ═══════════════════════════════════════════════════
   SeminarIA — Database Seed Utility
   Creates default admin user on first startup
   ═══════════════════════════════════════════════════ */

const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

const SALT_ROUNDS = 12;

/**
 * Seed the default admin user if no admin exists
 */
async function seedAdmin() {
    try {
        // Check if admin already exists
        const existing = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");

        if (existing.rows.length > 0) {
            console.log('ℹ️  Admin user already exists, skipping seed');
            return;
        }

        const adminEmail = process.env.ADMIN_EMAIL || 'admin@seminaria.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        const adminName = process.env.ADMIN_NAME || 'Administrador';

        const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);

        await pool.query(
            `INSERT INTO users (name, email, password_hash, role)
             VALUES ($1, $2, $3, 'admin')
             ON CONFLICT (email) DO NOTHING`,
            [adminName, adminEmail, passwordHash]
        );

        console.log(`✅ Admin user seeded: ${adminEmail}`);

    } catch (err) {
        console.error('⚠️  Error seeding admin:', err.message);
    }
}

module.exports = { seedAdmin };
