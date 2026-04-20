-- ═══════════════════════════════════════════════════
-- SeminarIA — Limpiar datos de prueba
-- Borra todos los datos EXCEPTO el usuario admin
-- ═══════════════════════════════════════════════════

-- Borrar en orden para respetar foreign keys
TRUNCATE TABLE suggestion_votes CASCADE;
TRUNCATE TABLE suggestions CASCADE;
TRUNCATE TABLE evaluations CASCADE;
TRUNCATE TABLE sessions RESTART IDENTITY CASCADE;

-- Borrar submissions y deliverables si existen
TRUNCATE TABLE submissions CASCADE;
TRUNCATE TABLE deliverables RESTART IDENTITY CASCADE;

-- Borrar usuarios estudiantes (conservar admin)
DELETE FROM users WHERE role = 'estudiante';

-- Reiniciar secuencia de IDs de users desde donde está el admin
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
