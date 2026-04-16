-- Migration: 003_add_submission_attempts
-- Habilita múltiples envíos por estudiante (hasta 2) marcando los anteriores como eliminados.

-- 1. Eliminar el índice único existente
DROP INDEX IF EXISTS idx_submissions_unique;

-- 2. Agregar nuevas columnas
ALTER TABLE deliverable_submissions 
ADD COLUMN IF NOT EXISTS attempt_number INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Crear un nuevo índice único que solo aplique para envíos NO eliminados
-- Si deseamos que solo haya UNA entrega activa a la vez por estudiante:
CREATE UNIQUE INDEX idx_submissions_active_unique 
ON deliverable_submissions(deliverable_id, user_id) 
WHERE is_deleted = FALSE;
