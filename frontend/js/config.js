/* ═══════════════════════════════════════════════════
   SeminarIA — Config Module
   Loads and saves app configuration via API
   ═══════════════════════════════════════════════════ */

const SeminariaConfig = (function () {
    'use strict';

    async function load() {
        try {
            const data = await SeminariaAPI.get('/config');
            const cfg = data.config || {};

            setValue('cfg-nombre', cfg.seminar_name);
            setValue('cfg-universidad', cfg.university);
            setValue('cfg-programa', cfg.program);
            setValue('cfg-sesiones', cfg.total_sessions);
            setChecked('cfg-anonimo', cfg.anonymous_eval);

            // Restore saved color
            if (cfg.primary_color) {
                document.documentElement.style.setProperty('--primary', cfg.primary_color);
                document.documentElement.style.setProperty('--primary-dim', cfg.primary_color + '26');
                document.documentElement.style.setProperty('--primary-glow', cfg.primary_color + '66');
                document.querySelectorAll('.color-option').forEach(o => {
                    o.classList.toggle('active', o.dataset.color === cfg.primary_color);
                });
            }
        } catch (err) {
            console.error('Config load error:', err);
        }
    }

    async function save() {
        const btn = document.getElementById('btn-save-config');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        }

        try {
            const payload = {
                seminar_name: getValue('cfg-nombre'),
                university: getValue('cfg-universidad'),
                program: getValue('cfg-programa'),
                total_sessions: parseInt(getValue('cfg-sesiones')) || 12,
                anonymous_eval: getChecked('cfg-anonimo')
            };

            await SeminariaAPI.put('/config', payload);
            SeminariaToast.show('Configuración guardada', 'fa-check-circle');
        } catch (err) {
            console.error('Config save error:', err);
            SeminariaToast.show('Error al guardar configuración', 'fa-exclamation-triangle');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
            }
        }
    }

    function getValue(id) {
        const el = document.getElementById(id);
        return el ? el.value : '';
    }

    function setValue(id, val) {
        const el = document.getElementById(id);
        if (el && val !== undefined && val !== null) el.value = val;
    }

    function getChecked(id) {
        const el = document.getElementById(id);
        return el ? el.checked : true;
    }

    function setChecked(id, val) {
        const el = document.getElementById(id);
        if (el) el.checked = val !== false;
    }

    // Bind save button
    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('config-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                save();
            });
        }
    });

    return { load };
})();
