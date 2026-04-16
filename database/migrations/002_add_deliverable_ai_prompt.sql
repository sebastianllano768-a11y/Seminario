-- ═══════════════════════════════════════════════════
-- SeminarIA — Migration 002
-- Adds ai_prompt column to deliverables table
-- This column stores the teacher's specific evaluation
-- instructions that will be injected into the AI prompt.
-- NULL means: use generic academic evaluation criteria.
-- ═══════════════════════════════════════════════════

ALTER TABLE deliverables
    ADD COLUMN IF NOT EXISTS ai_prompt TEXT DEFAULT NULL;

COMMENT ON COLUMN deliverables.ai_prompt IS
    'Instrucciones específicas del docente para la evaluación IA de esta entrega. '
    'Se combina con el prompt base estandarizado del sistema.';
