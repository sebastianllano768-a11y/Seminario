/* ═══════════════════════════════════════════════════
   SeminarIA — Deliverables Module
   Admin: create deliverables with AI eval parameters,
          view submission status + AI feedback history
   Student: (handled in uploads section)
   ═══════════════════════════════════════════════════ */

const SeminariaDeliverables = (function () {
    'use strict';

    const createForm = document.getElementById('admin-create-deliverable-form');
    const listEl = document.getElementById('admin-deliverables-list');
    const paramsList = document.getElementById('del-params-list');
    const btnAddParam = document.getElementById('btn-add-param');

    // ═══════════════ PARAMETERS UI ═══════════════
    let paramCounter = 0;

    function addParameterRow(name, desc) {
        if (!paramsList) return;
        paramCounter++;
        const row = document.createElement('div');
        row.className = 'del-param-row';
        row.innerHTML = `
            <input type="text" class="form-control param-name" placeholder="Nombre del parámetro" value="${escapeHtml(name || '')}" required>
            <input type="text" class="form-control param-desc" placeholder="Descripción / qué se evalúa" value="${escapeHtml(desc || '')}" required>
            <button type="button" class="btn-icon btn-remove-param" title="Quitar"><i class="fas fa-times"></i></button>
        `;
        paramsList.appendChild(row);

        if (typeof gsap !== 'undefined') {
            gsap.fromTo(row, { opacity: 0, x: -15 }, { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out' });
        }
    }

    function getParameters() {
        if (!paramsList) return [];
        const rows = paramsList.querySelectorAll('.del-param-row');
        const params = [];
        rows.forEach(row => {
            const name = row.querySelector('.param-name').value.trim();
            const desc = row.querySelector('.param-desc').value.trim();
            if (name && desc) {
                params.push({ name, description: desc, weight: 1 });
            }
        });
        return params;
    }

    if (btnAddParam) {
        btnAddParam.addEventListener('click', () => addParameterRow('', ''));
    }

    // Remove parameter row
    document.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.btn-remove-param');
        if (removeBtn) {
            removeBtn.closest('.del-param-row').remove();
        }
    });

    // ═══════════════ LOAD DELIVERABLES ═══════════════
    async function load() {
        const user = SeminariaAuth.getUser();
        if (!user || user.role !== 'admin') return;

        try {
            const data = await SeminariaAPI.get('/deliverables');
            renderList(data.deliverables);
        } catch (err) {
            console.error('Error loading deliverables:', err);
        }
    }

    // ═══════════════ RENDER LIST ═══════════════
    function renderList(deliverables) {
        if (!listEl) return;

        if (deliverables.length === 0) {
            listEl.innerHTML = `
                <div class="glass-card" style="padding: 40px; text-align: center;">
                    <i class="fas fa-folder-open" style="font-size: 40px; opacity: 0.3; margin-bottom: 12px;"></i>
                    <p style="opacity: 0.5;">No hay entregas creadas aún.</p>
                </div>
            `;
            return;
        }

        listEl.innerHTML = '';
        deliverables.forEach(del => {
            const now = new Date();
            const deadline = new Date(del.deadline);
            const isOpen = deadline > now;
            const statusClass = isOpen ? 'badge-success' : 'badge-warning';
            const statusText = isOpen ? 'Activa' : 'Cerrada';
            const deadlineStr = deadline.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) + ' — ' + deadline.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

            const paramBadge = del.param_count > 0
                ? `<span class="activity-badge badge-info" style="font-size: 0.72rem;"><i class="fas fa-brain"></i> ${del.param_count} parámetros IA</span>`
                : '';

            const card = document.createElement('div');
            card.className = 'deliverable-card glass-card';
            card.innerHTML = `
                <div class="del-info" style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap;">
                        <span class="activity-badge ${statusClass}">${statusText}</span>
                        ${paramBadge}
                        <h4 style="margin: 0; font-size: 1rem; font-weight: 600; color: var(--text-primary);">${escapeHtml(del.title)}</h4>
                    </div>
                    ${del.description ? `<p class="del-description" style="font-size: 0.82rem; opacity: 0.6; margin: 0 0 8px 0;">${escapeHtml(del.description)}</p>` : ''}
                    <div class="del-deadline" style="font-size: 0.82rem; opacity: 0.5; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-calendar-alt"></i> ${deadlineStr}
                    </div>
                    <div class="deliverable-stats">
                        <span class="del-stat del-stat-ok"><i class="fas fa-check-circle"></i> ${del.on_time || 0} a tiempo</span>
                        <span class="del-stat del-stat-late"><i class="fas fa-exclamation-circle"></i> ${del.late || 0} con retraso</span>
                        <span class="del-stat del-stat-total"><i class="fas fa-users"></i> ${del.total_submissions || 0} entregadas</span>
                    </div>
                </div>
                <div class="del-actions" style="display: flex; gap: 8px; flex-shrink: 0;">
                    <button class="btn-icon btn-view-feedback-history" data-del-id="${del.id}" title="Retroalimentación IA" ${del.param_count > 0 ? '' : 'style="display:none;"'}>
                        <i class="fas fa-brain"></i>
                    </button>
                    <button class="btn-icon btn-view-del-status" data-del-id="${del.id}" title="Ver detalle">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon btn-delete-del" data-del-id="${del.id}" title="Eliminar">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `;
            listEl.appendChild(card);
        });

        if (typeof gsap !== 'undefined') {
            gsap.fromTo('.deliverable-card', { opacity: 0, y: 20, scale: 0.97 }, {
                opacity: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.08, ease: 'power3.out'
            });
        }
    }

    // ═══════════════ CREATE DELIVERABLE ═══════════════
    if (createForm) {
        createForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const title = document.getElementById('new-del-title').value.trim();
            const deadline = document.getElementById('new-del-deadline').value;
            const description = document.getElementById('new-del-desc').value.trim();
            const ai_prompt = document.getElementById('new-del-ai-prompt')?.value.trim() || null;
            const parameters = getParameters();

            if (!title || !deadline) {
                SeminariaToast.warning('Completa el nombre y la fecha límite');
                return;
            }

            const btn = document.getElementById('btn-create-del');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando...';

            try {
                await SeminariaAPI.post('/deliverables', {
                    title,
                    description,
                    deadline: new Date(deadline).toISOString(),
                    ai_prompt: ai_prompt || null,
                    parameters
                });
                SeminariaToast.success('¡Entrega creada exitosamente!');
                createForm.reset();
                // Clear parameter rows
                if (paramsList) paramsList.innerHTML = '';
                paramCounter = 0;
                await load();
            } catch (err) {
                SeminariaToast.error(err.error || 'Error al crear la entrega');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-folder-plus"></i> Crear Entrega';
            }
        });
    }

    // ═══════════════ DELETE / VIEW / FEEDBACK (Event Delegation) ═══════════════
    document.addEventListener('click', async (e) => {
        const delBtn = e.target.closest('.btn-delete-del');
        if (delBtn) {
            if (!confirm('¿Eliminar esta entrega y todas sus entregas asociadas?')) return;
            try {
                await SeminariaAPI.del(`/deliverables/${delBtn.dataset.delId}`);
                SeminariaToast.success('Entrega eliminada');
                await load();
            } catch (err) {
                SeminariaToast.error(err.error || 'Error al eliminar');
            }
            return;
        }

        const viewBtn = e.target.closest('.btn-view-del-status');
        if (viewBtn) {
            try {
                const data = await SeminariaAPI.get(`/deliverables/${viewBtn.dataset.delId}/status`);
                showStatusModal(data);
            } catch (err) {
                SeminariaToast.error('Error al cargar el detalle');
            }
            return;
        }

        // AI Feedback history button
        const fbBtn = e.target.closest('.btn-view-feedback-history');
        if (fbBtn) {
            try {
                const data = await SeminariaAPI.get(`/deliverables/${fbBtn.dataset.delId}/feedback-history`);
                showFeedbackHistoryModal(data.submissions, fbBtn.dataset.delId);
            } catch (err) {
                SeminariaToast.error('Error al cargar retroalimentación');
            }
        }
    });

    // ═══════════════ STATUS MODAL ═══════════════
    function showStatusModal(data) {
        const { deliverable, submissions, total_students, submitted, missing } = data;

        let html = `<div class="del-status-overlay" id="del-status-overlay">
            <div class="del-status-modal glass-card">
                <div class="del-status-header">
                    <h3>${escapeHtml(deliverable.title)}</h3>
                    <button class="btn-icon" id="close-del-status"><i class="fas fa-times"></i></button>
                </div>
                <div class="del-status-summary">
                    <span class="del-stat del-stat-ok"><i class="fas fa-users"></i> ${total_students} estudiantes</span>
                    <span class="del-stat del-stat-ok"><i class="fas fa-check-circle"></i> ${submitted} entregadas</span>
                    <span class="del-stat del-stat-late"><i class="fas fa-times-circle"></i> ${missing} pendientes</span>
                </div>`;

        if (submissions.length > 0) {
            html += `<div class="del-status-list">`;
            submissions.forEach(sub => {
                const downloadUrl = `${SeminariaAPI.getBaseUrl()}/deliverables/submission/${sub.id}/download?token=${SeminariaAPI.getToken()}`;
                const aiScoreBadge = sub.overall_score !== null && sub.ai_status === 'completed'
                    ? `<span class="activity-badge badge-info" style="font-size:0.72rem;"><i class="fas fa-brain"></i> ${sub.overall_score}/100</span>`
                    : (sub.ai_status === 'pending' ? `<span class="activity-badge" style="font-size:0.72rem; opacity:0.5;"><i class="fas fa-spinner fa-spin"></i> Evaluando...</span>` : '');

                html += `
                    <div class="del-status-item">
                        <span><i class="fas fa-user-circle"></i> ${escapeHtml(sub.user_name)}</span>
                        <span class="del-status-file">${escapeHtml(sub.original_name)}</span>
                        ${aiScoreBadge}
                        <a href="${downloadUrl}" target="_blank" class="btn-icon" title="Descargar" style="color: var(--primary);"><i class="fas fa-download"></i></a>
                        <span class="activity-badge ${sub.is_late ? 'badge-warning' : 'badge-success'}">${sub.is_late ? 'Retraso' : 'A tiempo'}</span>
                    </div>
                `;
            });
            html += `</div>`;
        } else {
            html += `<p style="text-align:center; opacity: 0.5; padding: 24px;">Aún no hay entregas recibidas.</p>`;
        }

        html += `</div></div>`;

        const existing = document.getElementById('del-status-overlay');
        if (existing) existing.remove();

        document.body.insertAdjacentHTML('beforeend', html);

        document.getElementById('close-del-status').addEventListener('click', () => {
            document.getElementById('del-status-overlay').remove();
        });
        document.getElementById('del-status-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'del-status-overlay') e.target.remove();
        });
    }

    // ═══════════════ FEEDBACK HISTORY MODAL (Admin) ═══════════════
    function showFeedbackHistoryModal(submissions, delId) {
        let html = `<div class="del-status-overlay" id="del-feedback-overlay">
            <div class="del-status-modal glass-card" style="max-width: 700px;">
                <div class="del-status-header">
                    <h3><i class="fas fa-brain" style="margin-right: 8px; color: var(--primary);"></i>Retroalimentación IA</h3>
                    <button class="btn-icon" id="close-feedback-history"><i class="fas fa-times"></i></button>
                </div>`;

        if (submissions.length === 0) {
            html += `<p style="text-align:center; opacity: 0.5; padding: 24px;">No hay entregas con retroalimentación aún.</p>`;
        } else {
            html += `<div class="del-status-list">`;
            submissions.forEach(sub => {
                const scoreColor = sub.overall_score >= 70 ? '#00ff88' : sub.overall_score >= 40 ? '#ffd166' : '#ff6b9d';
                const statusIcon = sub.ai_status === 'completed'
                    ? `<span style="color: ${scoreColor}; font-weight: 700; font-size: 1.1rem;">${sub.overall_score}/100</span>`
                    : sub.ai_status === 'pending'
                        ? `<span style="opacity: 0.5;"><i class="fas fa-spinner fa-spin"></i> Evaluando</span>`
                        : sub.ai_status === 'error'
                            ? `<span style="color: #ff6b9d;"><i class="fas fa-exclamation-triangle"></i> Error</span>`
                            : `<span style="opacity: 0.4;">Sin evaluar</span>`;

                const isDeletedText = sub.is_deleted ? ' <span style="font-size:0.7rem; color:#ff6b9d; margin-left: 6px;">(Descartado)</span>' : '';
                
                html += `
                    <div class="del-status-item feedback-history-item" data-sub-id="${sub.submission_id}" style="cursor: pointer; opacity: ${sub.is_deleted ? '0.7' : '1'};">
                        <div style="flex: 1; display: flex; flex-direction: column;">
                            <div><span><i class="fas fa-user-circle"></i> ${escapeHtml(sub.user_name)}</span>${isDeletedText}</div>
                            <span class="del-status-file" style="font-size:0.75rem; opacity:0.6; margin-top:2px;">Intento ${sub.attempt_number || 1} — ${escapeHtml(sub.original_name)}</span>
                        </div>
                        ${statusIcon}
                        <span class="activity-badge ${sub.is_late ? 'badge-warning' : 'badge-success'}" style="font-size: 0.72rem;">${sub.is_late ? 'Retraso' : 'A tiempo'}</span>
                        <i class="fas fa-chevron-right" style="opacity: 0.3; margin-left: 4px;"></i>
                    </div>
                `;
            });
            html += `</div>`;
        }

        html += `</div></div>`;

        const existing = document.getElementById('del-feedback-overlay');
        if (existing) existing.remove();

        document.body.insertAdjacentHTML('beforeend', html);

        document.getElementById('close-feedback-history').addEventListener('click', () => {
            document.getElementById('del-feedback-overlay').remove();
        });
        document.getElementById('del-feedback-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'del-feedback-overlay') e.target.remove();
        });

        // Click on a student row to see detailed feedback
        document.querySelectorAll('.feedback-history-item').forEach(item => {
            item.addEventListener('click', async () => {
                const subId = item.dataset.subId;
                try {
                    const data = await SeminariaAPI.get(`/deliverables/submission/${subId}/feedback`);
                    showDetailedFeedbackModal(data, item.querySelector('span').textContent.trim());
                } catch (err) {
                    SeminariaToast.error('Error al cargar detalle');
                }
            });
        });
    }

    // ═══════════════ DETAILED FEEDBACK MODAL ═══════════════
    function showDetailedFeedbackModal(data, studentName) {
        const { summary, feedback } = data;

        let html = `<div class="del-status-overlay" id="del-detail-overlay" style="z-index: 10001;">
            <div class="del-status-modal glass-card" style="max-width: 650px;">
                <div class="del-status-header">
                    <h3><i class="fas fa-clipboard-check" style="margin-right: 8px; color: var(--primary);"></i>Retroalimentaci\u00f3n — ${escapeHtml(studentName)}</h3>
                    <button class="btn-icon" id="close-detail-feedback"><i class="fas fa-times"></i></button>
                </div>`;

        if (summary && summary.status === 'completed') {
            const scoreColor = summary.overall_score >= 70 ? '#00ff88' : summary.overall_score >= 40 ? '#ffd166' : '#ff6b9d';
            const scoreMsg = summary.overall_score >= 70 ? 'Nivel satisfactorio' : summary.overall_score >= 40 ? 'En desarrollo' : 'Requiere mejoras';
            html += `
                <div style="text-align: center; padding: 16px 0;">
                    <div class="feedback-score-circle" style="border-color: ${scoreColor};">
                        <span style="color: ${scoreColor}; font-size: 1.6rem; font-weight: 700;">${summary.overall_score}%</span>
                    </div>
                    <p style="font-size: 0.88rem; font-weight: 600; color: ${scoreColor}; margin-top: 8px;">${scoreMsg}</p>
                    <p style="opacity: 0.45; font-size: 0.75rem; margin-top: 2px;">Cumplimiento general de los criterios evaluados</p>
                </div>
            `;
        } else if (summary && summary.status === 'pending') {
            html += `<p style="text-align:center; padding: 24px; opacity: 0.5;"><i class="fas fa-spinner fa-spin"></i> Tu entrega est\u00e1 siendo analizada, vuelve en unos minutos...</p>`;
        } else if (summary && summary.status === 'error') {
            html += `<p style="text-align:center; padding: 24px; opacity: 0.5;"><i class="fas fa-clock"></i> Los resultados estar\u00e1n disponibles pronto.</p>`;
        }

        if (feedback && feedback.length > 0) {
            feedback.forEach(fb => {
                const fbScoreColor = fb.score >= 70 ? '#00ff88' : fb.score >= 40 ? '#ffd166' : '#ff6b9d';
                html += `
                    <div class="feedback-param-card">
                        <div class="feedback-param-header">
                            <span class="feedback-param-name">${escapeHtml(fb.parameter_name)}</span>
                            <span class="feedback-param-score" style="color: ${fbScoreColor}; font-weight: 700;">Cumples el ${fb.score}%</span>
                        </div>
                        <div style="margin-bottom: 4px;">
                            <div class="feedback-param-bar">
                                <div class="feedback-param-bar-fill" style="width: ${fb.score}%; background: ${fbScoreColor};"></div>
                            </div>
                            <p style="font-size: 0.7rem; opacity: 0.4; margin: 3px 0 8px 0;">de lo solicitado en este criterio</p>
                        </div>
                        ${fb.strengths ? `<div class="feedback-section"><i class="fas fa-check-circle" style="color: #00ff88;"></i> <strong>Lo que haces bien:</strong> ${escapeHtml(fb.strengths)}</div>` : ''}
                        ${fb.improvements ? `<div class="feedback-section"><i class="fas fa-arrow-circle-up" style="color: #ffd166;"></i> <strong>D\u00f3nde mejorar:</strong> ${escapeHtml(fb.improvements)}</div>` : ''}
                        ${fb.summary ? `<div class="feedback-section" style="opacity: 0.65; font-size: 0.79rem; border-top: 1px solid rgba(255,255,255,0.06); margin-top: 8px; padding-top: 8px;"><i class="fas fa-comment-alt"></i> ${escapeHtml(fb.summary)}</div>` : ''}
                    </div>
                `;
            });
        } else if (!summary || summary.status !== 'pending') {
            html += `<p style="text-align:center; padding: 24px; opacity: 0.5;">Los resultados estar\u00e1n disponibles pronto.</p>`;
        }

        html += `</div></div>`;

        const existing = document.getElementById('del-detail-overlay');
        if (existing) existing.remove();

        document.body.insertAdjacentHTML('beforeend', html);

        document.getElementById('close-detail-feedback').addEventListener('click', () => {
            document.getElementById('del-detail-overlay').remove();
        });
        document.getElementById('del-detail-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'del-detail-overlay') e.target.remove();
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    return { load, showDetailedFeedbackModal };
})();
