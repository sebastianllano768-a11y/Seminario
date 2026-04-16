/* ═══════════════════════════════════════════════════
   SeminarIA — PostgreSQL Connection Pool
   ═══════════════════════════════════════════════════ */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    max: 20,                    // Max pool connections
    idleTimeoutMillis: 30000,   // Close idle connections after 30s
    connectionTimeoutMillis: 5000 // Fail connection after 5s
});

// Handle pool errors
pool.on('error', (err) => {
    console.error('❌ PostgreSQL pool error:', err.message);
});

/**
 * Test database connectivity
 */
async function testConnection() {
    const client = await pool.connect();
    try {
        await client.query('SELECT 1');
    } finally {
        client.release();
    }
}

module.exports = { pool, testConnection };
