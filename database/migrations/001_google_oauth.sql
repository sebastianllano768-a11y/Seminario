-- Migration: Add Google OAuth columns to users table
-- Run this if you already have data in your database and cannot recreate

-- Add Google-specific columns
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS google_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512);

-- Make password_hash nullable (Google users)
ALTER TABLE users
    ALTER COLUMN password_hash DROP NOT NULL;

-- Add unique index on google_id (only where not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
