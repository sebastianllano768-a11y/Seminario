-- ═══════════════════════════════════════════════════
-- SeminarIA — Database Schema (PostgreSQL 16)
-- ═══════════════════════════════════════════════════

-- Enable UUID extension for future use
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── ENUM Types ───
CREATE TYPE user_role AS ENUM ('admin', 'estudiante');
CREATE TYPE session_status AS ENUM ('pendiente', 'completada');
CREATE TYPE upload_status AS ENUM ('en_revision', 'aprobado', 'rechazado');
CREATE TYPE suggestion_category AS ENUM ('contenido', 'metodologia', 'recursos', 'organizacion', 'otro');

-- ═══════════════ TABLES ═══════════════

-- ─── Users ───
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    google_id VARCHAR(255),
    avatar_url VARCHAR(512),
    role user_role NOT NULL DEFAULT 'estudiante',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ─── Seminar Sessions ───
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    session_number INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status session_status NOT NULL DEFAULT 'pendiente',
    session_date DATE,
    eval_deadline TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sessions_number ON sessions(session_number);

-- ─── Evaluations ───
CREATE TABLE evaluations (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    score_contenido INT NOT NULL CHECK (score_contenido >= 1 AND score_contenido <= 10),
    score_docente INT NOT NULL CHECK (score_docente >= 1 AND score_docente <= 10),
    score_material INT NOT NULL CHECK (score_material >= 1 AND score_material <= 10),
    score_participacion INT NOT NULL CHECK (score_participacion >= 1 AND score_participacion <= 10),
    fortalezas TEXT,
    mejoras TEXT,
    comentarios TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_evaluations_user ON evaluations(user_id);
CREATE INDEX idx_evaluations_session ON evaluations(session_id);
-- Prevent duplicate evaluations: one per user per session
CREATE UNIQUE INDEX idx_evaluations_unique ON evaluations(user_id, session_id);

-- ─── Suggestions ───
CREATE TABLE suggestions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category suggestion_category NOT NULL DEFAULT 'otro',
    content TEXT NOT NULL,
    is_anonymous BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_suggestions_category ON suggestions(category);
CREATE INDEX idx_suggestions_user ON suggestions(user_id);

-- ─── Suggestion Votes ───
CREATE TABLE suggestion_votes (
    id SERIAL PRIMARY KEY,
    suggestion_id INT NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- One vote per user per suggestion
CREATE UNIQUE INDEX idx_votes_unique ON suggestion_votes(suggestion_id, user_id);

-- ─── Deliverables (Entregas) ───
CREATE TABLE deliverables (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    -- Teacher's custom AI evaluation instructions (injected into the standardized base prompt).
    -- NULL = use generic academic evaluation criteria.
    ai_prompt TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── Deliverable Submissions (Entregas de estudiantes) ───
CREATE TABLE deliverable_submissions (
    id SERIAL PRIMARY KEY,
    deliverable_id INT NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mimetype VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_late BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX idx_submissions_unique ON deliverable_submissions(deliverable_id, user_id);
CREATE INDEX idx_submissions_deliverable ON deliverable_submissions(deliverable_id);
CREATE INDEX idx_submissions_user ON deliverable_submissions(user_id);

-- ─── File Uploads ───
CREATE TABLE uploads (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mimetype VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    status upload_status NOT NULL DEFAULT 'en_revision',
    ai_feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_uploads_user ON uploads(user_id);
CREATE INDEX idx_uploads_status ON uploads(status);

-- ─── Application Config ───
CREATE TABLE app_config (
    id SERIAL PRIMARY KEY,
    seminar_name VARCHAR(255) NOT NULL DEFAULT 'Seminario de Investigación en Maestría',
    university VARCHAR(255) DEFAULT '',
    program VARCHAR(255) DEFAULT '',
    total_sessions INT NOT NULL DEFAULT 12,
    anonymous_eval BOOLEAN NOT NULL DEFAULT TRUE,
    primary_color VARCHAR(7) NOT NULL DEFAULT '#00ff88',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ═══════════════ SEED DATA ═══════════════

-- Default config (single row)
INSERT INTO app_config (seminar_name, total_sessions, anonymous_eval, primary_color)
VALUES ('Seminario de Investigación en Maestría', 12, TRUE, '#00ff88');

-- No default sessions — admin creates them dynamically

-- ─── Updated_at trigger function ───
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_uploads_updated_at BEFORE UPDATE ON uploads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_config_updated_at BEFORE UPDATE ON app_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deliverables_updated_at BEFORE UPDATE ON deliverables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
