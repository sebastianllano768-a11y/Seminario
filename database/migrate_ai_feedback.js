/**
 * Migration: Add AI evaluation parameters and feedback tables
 */
const path = require('path');
const { Pool } = require(path.resolve(__dirname, '../backend/node_modules/pg'));
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    try {
        // Table: evaluation parameters per deliverable
        await pool.query(`
            CREATE TABLE IF NOT EXISTS deliverable_parameters (
                id SERIAL PRIMARY KEY,
                deliverable_id INT NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                weight INT NOT NULL DEFAULT 1,
                sort_order INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        console.log('✅ deliverable_parameters table created');

        // Table: AI feedback per submission per parameter
        await pool.query(`
            CREATE TABLE IF NOT EXISTS submission_feedback (
                id SERIAL PRIMARY KEY,
                submission_id INT NOT NULL REFERENCES deliverable_submissions(id) ON DELETE CASCADE,
                parameter_id INT NOT NULL REFERENCES deliverable_parameters(id) ON DELETE CASCADE,
                score INT NOT NULL DEFAULT 0,
                max_score INT NOT NULL DEFAULT 100,
                strengths TEXT,
                improvements TEXT,
                summary TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        console.log('✅ submission_feedback table created');

        // Table: general AI feedback summary per submission
        await pool.query(`
            CREATE TABLE IF NOT EXISTS submission_ai_summary (
                id SERIAL PRIMARY KEY,
                submission_id INT NOT NULL REFERENCES deliverable_submissions(id) ON DELETE CASCADE,
                overall_score INT NOT NULL DEFAULT 0,
                overall_summary TEXT,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                evaluated_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(submission_id)
            );
        `);
        console.log('✅ submission_ai_summary table created');

        // Indexes
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_params_deliverable ON deliverable_parameters(deliverable_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_feedback_submission ON submission_feedback(submission_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_feedback_parameter ON submission_feedback(parameter_id);`);

        console.log('✅ Migration complete');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration error:', err.message);
        process.exit(1);
    }
}

migrate();
