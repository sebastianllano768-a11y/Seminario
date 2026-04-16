/* ═══════════════════════════════════════════════════
   SeminarIA — Evaluations Module
   Student: form submission, star rating
   Admin: create sessions, view reports
   ═══════════════════════════════════════════════════ */

const SeminariaEvaluations = (function () {
    'use strict';

    // ─── Student DOM ───
    const evalForm = document.getElementById('evaluation-form');
    const sessionSelect = document.getElementById('eval-session');
    const starRating = document.getElementById('star-rating');
    const ratingInput = document.getElementById('eval-rating');

    // ─── Admin DOM ───
    const createSessionForm = document.getElementById('admin-create-session-form');
    const sessionsList = document.getElementById('admin-sessions-list');
    const reportSection = document.getElementById('eval-report-section');
    const reportStats = document.getElementById('eval-report-stats');
    const reportEmpty = document.getElementById('eval-report-empty');
    const reportList = document.getElementById('eval-report-list');
    const reportTitle = document.getElementById('report-session-title');

    const rangeInputs = [
        { input: 'eval-contenido', display: 'val-contenido' },
        { input: 'eval-docente', display: 'val-docente' },
        { input: 'eval-material', display: 'val-material' },
        { input: 'eval-participacion', display: 'val-participacion' }
    ];

    // ═══════════════ LOAD SESSIONS ═══════════════
    async function loadSessions() {
        try {
            const data = await SeminariaAPI.get('/sessions');
            const user = SeminariaAuth.getUser();

            if (user && user.role === 'admin') {
                renderAdminSessions(data.sessions);
            } else {
                populateStudentDropdown(data.sessions);
            }
        } catch (err) {
            console.error('Error loading sessions:', err);
        }
    }

    // ═══════════════ ADMIN: RENDER SESSIONS LIST ═══════════════
    function renderAdminSessions(sessions) {
        if (!sessionsList) return;

        if (sessions.length === 0) {
            sessionsList.innerHTML = `
                <div class="glass-card" style="padding: 48px; text-align: center;">
                    <i class="fas fa-calendar-plus" style="font-size: 48px; opacity: 0.3; margin-bottom: 16px;"></i>
                    <p style="opacity: 0.6;">No hay sesiones creadas. Crea la primera sesión arriba.</p>
                </div>
            `;
            return;
        }

        sessionsList.innerHTML = '';
        sessions.forEach(session => {
            const now = new Date();
            const deadline = session.eval_deadline ? new Date(session.eval_deadline) : null;
            const isOpen = deadline && deadline > now;
            const statusClass = isOpen ? 'badge-success' : (deadline ? 'badge-warning' : 'badge-info');
            const statusText = isOpen ? 'Abierta' : (deadline ? 'Cerrada' : 'Sin plazo');

            const card = document.createElement('div');
            card.className = 'admin-session-card glass-card';
            card.innerHTML = `
                <div class="admin-session-info">
                    <div class="admin-session-top">
                        <span class="admin-session-number">Sesión ${session.session_number}</span>
                        <span class="activity-badge ${statusClass}">${statusText}</span>
                    </div>
                    <h4 class="admin-session-title">${escapeHtml(session.title)}</h4>
                    ${session.description ? `<p class="admin-session-desc">${escapeHtml(session.description)}</p>` : ''}
                    <div class="admin-session-dates">
                        ${session.session_date ? `<span><i class="fas fa-calendar"></i> ${new Date(session.session_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>` : ''}
                        ${deadline ? `<span><i class="fas fa-clock"></i> Plazo: ${deadline.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} ${deadline.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>` : ''}
                    </div>
                </div>
                <div class="admin-session-actions">
                    <button class="btn-icon btn-view-report" data-session-id="${session.id}" data-session-title="${escapeHtml(session.title)}" title="Ver reporte">
                        <i class="fas fa-chart-bar"></i>
                    </button>
                    <button class="btn-icon btn-delete-session" data-session-id="${session.id}" title="Eliminar">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `;
            sessionsList.appendChild(card);
        });

        // Animate
        if (typeof gsap !== 'undefined') {
            gsap.fromTo('.admin-session-card', { opacity: 0, y: 20, scale: 0.97 }, {
                opacity: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.08, ease: 'power3.out'
            });
        }
    }

    // ═══════════════ ADMIN: CREATE SESSION ═══════════════
    if (createSessionForm) {
        createSessionForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const title = document.getElementById('new-session-title').value.trim();
            const session_date = document.getElementById('new-session-date').value;
            const eval_deadline = document.getElementById('new-session-deadline').value;
            const description = document.getElementById('new-session-desc').value.trim();

            if (!title || !session_date || !eval_deadline) {
                SeminariaToast.warning('Completa el nombre, fecha y plazo de la sesión');
                return;
            }

            const btn = document.getElementById('btn-create-session');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando...';

            try {
                await SeminariaAPI.post('/sessions', {
                    title,
                    description,
                    session_date,
                    eval_deadline: new Date(eval_deadline).toISOString()
                });
                SeminariaToast.success('¡Sesión creada exitosamente!');
                createSessionForm.reset();
                await loadSessions();
            } catch (err) {
                SeminariaToast.error(err.error || 'Error al crear la sesión');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-calendar-plus"></i> Crear Sesión';
            }
        });
    }

    // ═══════════════ ADMIN: VIEW REPORT / DELETE (Event Delegation) ═══════════════
    document.addEventListener('click', async (e) => {
        // View report
        const viewBtn = e.target.closest('.btn-view-report');
        if (viewBtn) {
            const sessionId = viewBtn.dataset.sessionId;
            const sessionTitle = viewBtn.dataset.sessionTitle;
            if (reportTitle) reportTitle.textContent = `Reporte — ${sessionTitle}`;
            try {
                const data = await SeminariaAPI.get(`/evaluations/session/${sessionId}`);
                renderAdminReport(data);
                if (reportSection) reportSection.style.display = 'block';
                reportSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } catch (err) {
                SeminariaToast.error('Error al cargar el reporte');
            }
            return;
        }

        // Delete session
        const delBtn = e.target.closest('.btn-delete-session');
        if (delBtn) {
            if (!confirm('¿Eliminar esta sesión? Se borrarán también las evaluaciones asociadas.')) return;
            try {
                await SeminariaAPI.del(`/sessions/${delBtn.dataset.sessionId}`);
                SeminariaToast.success('Sesión eliminada');
                await loadSessions();
                if (reportSection) reportSection.style.display = 'none';
            } catch (err) {
                SeminariaToast.error(err.error || 'Error al eliminar');
            }
        }
    });

    // ═══════════════ ADMIN: RENDER REPORT ═══════════════
    function renderAdminReport(data) {
        const { evaluations, stats } = data;

        if (!evaluations || evaluations.length === 0) {
            if (reportStats) reportStats.style.display = 'none';
            if (reportEmpty) reportEmpty.style.display = 'flex';
            if (reportList) reportList.innerHTML = '';
            return;
        }

        if (reportStats) {
            reportStats.style.display = 'block';
            document.getElementById('stat-count').textContent = stats.count;
            document.getElementById('stat-rating').textContent = stats.avg_rating;
            document.getElementById('stat-contenido').textContent = stats.avg_contenido;
            document.getElementById('stat-docente').textContent = stats.avg_docente;
        }
        if (reportEmpty) reportEmpty.style.display = 'none';

        if (reportList) {
            reportList.innerHTML = '';
            evaluations.forEach(ev => {
                const card = document.createElement('div');
                card.className = 'eval-report-card glass-card';
                card.innerHTML = `
                    <div class="eval-report-card-header">
                        <div class="eval-report-user">
                            <i class="fas fa-user-circle"></i>
                            <span>${escapeHtml(ev.user_name)}</span>
                        </div>
                        <div class="eval-report-rating">
                            ${'<i class="fas fa-star" style="color: #ffd166;"></i>'.repeat(ev.rating)}${'<i class="fas fa-star" style="color: rgba(255,255,255,0.1);"></i>'.repeat(5 - ev.rating)}
                        </div>
                    </div>
                    <div class="eval-report-scores">
                        <div class="eval-score-pill"><span>Contenido</span><strong>${ev.score_contenido}/10</strong></div>
                        <div class="eval-score-pill"><span>Docencia</span><strong>${ev.score_docente}/10</strong></div>
                        <div class="eval-score-pill"><span>Material</span><strong>${ev.score_material}/10</strong></div>
                        <div class="eval-score-pill"><span>Participación</span><strong>${ev.score_participacion}/10</strong></div>
                    </div>
                    ${ev.fortalezas ? `<div class="eval-report-comment"><i class="fas fa-arrow-up" style="color: #00ff88;"></i><p>${escapeHtml(ev.fortalezas)}</p></div>` : ''}
                    ${ev.mejoras ? `<div class="eval-report-comment"><i class="fas fa-arrow-down" style="color: #ff6b9d;"></i><p>${escapeHtml(ev.mejoras)}</p></div>` : ''}
                    ${ev.comentarios ? `<div class="eval-report-comment"><i class="fas fa-comment" style="color: #00c9ff;"></i><p>${escapeHtml(ev.comentarios)}</p></div>` : ''}
                    <div class="eval-report-date">${new Date(ev.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                `;
                reportList.appendChild(card);
            });

            if (typeof gsap !== 'undefined') {
                gsap.fromTo('.eval-report-card', { opacity: 0, y: 25, scale: 0.96 }, {
                    opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.1, ease: 'power3.out'
                });
            }
        }
    }

    // ═══════════════ STUDENT: POPULATE DROPDOWN ═══════════════
    function populateStudentDropdown(sessions) {
        if (!sessionSelect) return;
        sessionSelect.innerHTML = '<option value="" disabled selected>Seleccionar sesión...</option>';
        sessions.forEach(session => {
            const option = document.createElement('option');
            option.value = session.id;
            const deadline = session.eval_deadline ? new Date(session.eval_deadline) : null;
            const deadlineStr = deadline ? ` — Plazo: ${deadline.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} ${deadline.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : '';
            option.textContent = `Sesión ${session.session_number}: ${session.title}${deadlineStr}`;
            sessionSelect.appendChild(option);
        });
    }

    // ═══════════════ STAR RATING (Student) ═══════════════
    if (starRating) {
        const stars = starRating.querySelectorAll('i');
        stars.forEach(star => {
            star.addEventListener('click', () => {
                const val = parseInt(star.dataset.value);
                ratingInput.value = val;
                stars.forEach(s => {
                    s.classList.toggle('active', parseInt(s.dataset.value) <= val);
                    s.classList.remove('hover-preview');
                });
            });
            star.addEventListener('mouseenter', () => {
                const val = parseInt(star.dataset.value);
                stars.forEach(s => {
                    if (!s.classList.contains('active') && parseInt(s.dataset.value) <= val) {
                        s.classList.add('hover-preview');
                    }
                });
            });
            star.addEventListener('mouseleave', () => {
                stars.forEach(s => s.classList.remove('hover-preview'));
            });
        });
    }

    // ═══════════════ RANGE SLIDERS (Student) ═══════════════
    rangeInputs.forEach(({ input, display }) => {
        const inputEl = document.getElementById(input);
        const displayEl = document.getElementById(display);
        if (inputEl && displayEl) {
            inputEl.addEventListener('input', () => { displayEl.textContent = inputEl.value; });
        }
    });

    // ═══════════════ FORM SUBMISSION (Student) ═══════════════
    if (evalForm) {
        evalForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const session_id = sessionSelect?.value;
            const rating = parseInt(ratingInput?.value || 0);

            if (!session_id) { SeminariaToast.warning('Selecciona una sesión para evaluar'); return; }
            if (rating < 1) { SeminariaToast.warning('Selecciona una calificación (estrellas)'); return; }

            const payload = {
                session_id: parseInt(session_id), rating,
                score_contenido: parseInt(document.getElementById('eval-contenido')?.value || 5),
                score_docente: parseInt(document.getElementById('eval-docente')?.value || 5),
                score_material: parseInt(document.getElementById('eval-material')?.value || 5),
                score_participacion: parseInt(document.getElementById('eval-participacion')?.value || 5),
                fortalezas: document.getElementById('eval-fortalezas')?.value?.trim() || '',
                mejoras: document.getElementById('eval-mejoras')?.value?.trim() || '',
                comentarios: document.getElementById('eval-comentarios')?.value?.trim() || ''
            };

            const btn = document.getElementById('btn-submit-eval');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

            try {
                await SeminariaAPI.post('/evaluations', payload);
                SeminariaToast.success('¡Evaluación enviada correctamente!');
                resetForm();
                if (typeof SeminariaDashboard !== 'undefined') SeminariaDashboard.load();
            } catch (err) {
                SeminariaToast.error(err.error || 'Error al enviar la evaluación');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Evaluación';
            }
        });
    }

    function resetForm() {
        if (evalForm) evalForm.reset();
        if (starRating) starRating.querySelectorAll('i').forEach(s => s.classList.remove('active', 'hover-preview'));
        if (ratingInput) ratingInput.value = 0;
        rangeInputs.forEach(({ display }) => {
            const el = document.getElementById(display);
            if (el) el.textContent = '5';
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    return { loadSessions };
})();
