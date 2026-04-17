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

        let html = `<div class="del-status-overlay" id="del-detail-overlay" style="z-index: 10001; backdrop-filter: blur(8px); background: rgba(0,0,0,0.6);">
            <div class="del-status-modal glass-card" style="max-width: 700px; border-radius: 24px; padding: 0; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.4);">
                <!-- Friendly Header -->
                <div style="background: linear-gradient(135deg, rgba(0,201,255,0.1), rgba(0,255,136,0.1)); padding: 24px 32px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <div style="width: 48px; height: 48px; border-radius: 16px; background: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: #000; box-shadow: 0 4px 12px rgba(0,255,136,0.3);">
                            <i class="fas fa-sparkles"></i>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 700;">Resultados de tu Entrega</h3>
                            <p style="margin: 4px 0 0 0; font-size: 0.85rem; opacity: 0.7;">Análisis detallado para ayudarte a mejorar</p>
                        </div>
                    </div>
                    <button class="btn-icon" id="close-detail-feedback" style="background: rgba(255,255,255,0.1); border-radius: 50%; width: 36px; height: 36px;"><i class="fas fa-times"></i></button>
                </div>
                
                <div style="padding: 32px; max-height: 70vh; overflow-y: auto;">
`;

        if (summary && summary.status === 'completed') {
            const scoreColor = summary.overall_score >= 80 ? '#00ff88' : summary.overall_score >= 60 ? '#00c9ff' : summary.overall_score >= 40 ? '#ffd166' : '#ff6b9d';
            const scoreIcon = summary.overall_score >= 80 ? 'fa-trophy' : summary.overall_score >= 60 ? 'fa-thumbs-up' : summary.overall_score >= 40 ? 'fa-tools' : 'fa-book-reader';
            const scoreMsg = summary.overall_score >= 80 ? '¡Excelente trabajo!' : summary.overall_score >= 60 ? 'Vas por muy buen camino' : summary.overall_score >= 40 ? 'Hay potencial para mejorar' : 'Requiere revisión profunda';
            
            html += `
                <!-- Global Summary Hero -->
                <div style="text-align: center; margin-bottom: 40px; background: rgba(255,255,255,0.02); padding: 32px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="position: relative; width: 120px; height: 120px; margin: 0 auto 16px auto;">
                        <svg viewBox="0 0 36 36" style="width: 100%; height: 100%; transform: rotate(-90deg);">
                            <path stroke="rgba(255,255,255,0.1)" stroke-width="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            <path stroke="${scoreColor}" stroke-width="3" stroke-dasharray="${summary.overall_score}, 100" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" style="transition: stroke-dasharray 1s ease-out;" />
                        </svg>
                        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                            <span style="font-size: 2rem; font-weight: 800; color: ${scoreColor}; line-height: 1;">${summary.overall_score}%</span>
                        </div>
                    </div>
                    <h4 style="font-size: 1.4rem; font-weight: 700; margin: 0 0 8px 0; color: #fff;"><i class="fas ${scoreIcon}" style="color: ${scoreColor}; margin-right: 8px;"></i>${scoreMsg}</h4>
                    <p style="font-size: 0.95rem; opacity: 0.7; max-width: 450px; margin: 0 auto; line-height: 1.5;">Este es tu nivel de cumplimiento respecto a las instrucciones que dejó el docente para esta entrega.</p>
                </div>
            `;
        } else if (summary && summary.status === 'pending') {
            html += `
                <div style="text-align: center; padding: 60px 20px;">
                    <div style="margin-bottom: 24px;">
                        <i class="fas fa-circle-notch fa-spin" style="font-size: 3rem; color: var(--primary);"></i>
                    </div>
                    <h4 style="font-size: 1.2rem; margin-bottom: 8px;">Estamos leyendo tu trabajo...</h4>
                    <p style="opacity: 0.6; font-size: 0.95rem;">La inteligencia artificial está revisando cada detalle según los criterios del docente. Tardará menos de un minuto.</p>
                </div>
            `;
        } else if (summary && summary.status === 'error') {
            html += `
                <div style="text-align: center; padding: 60px 20px; background: rgba(255,107,157,0.05); border-radius: 20px; border: 1px dashed rgba(255,107,157,0.3);">
                    <i class="fas fa-exclamation-circle" style="font-size: 3rem; color: #ff6b9d; margin-bottom: 16px;"></i>
                    <h4 style="font-size: 1.2rem; margin-bottom: 8px;">Tuvimos un problema técnico</h4>
                    <p style="opacity: 0.7; font-size: 0.95rem;">No pudimos completar la evaluación automática de tu archivo. Por favor, intenta subirlo nuevamente o contacta a tu docente.</p>
                </div>
            `;
        }

        if (feedback && feedback.length > 0) {
            html += `<h4 style="font-size: 1.1rem; margin: 0 0 16px 0; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);"><i class="fas fa-tasks" style="margin-right: 8px; opacity: 0.5;"></i>Evaluación por Criterios</h4>`;
            
            feedback.forEach((fb, index) => {
                const fbScoreColor = fb.score >= 80 ? '#00ff88' : fb.score >= 60 ? '#00c9ff' : fb.score >= 40 ? '#ffd166' : '#ff6b9d';
                
                html += `
                    <div style="background: rgba(255,255,255,0.02); border-radius: 16px; padding: 24px; margin-bottom: 20px; border-left: 4px solid ${fbScoreColor}; transition: transform 0.2s ease;">
                        
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                            <div>
                                <h5 style="margin: 0 0 4px 0; font-size: 1.05rem; font-weight: 600;">${index + 1}. ${escapeHtml(fb.parameter_name)}</h5>
                                <p style="margin: 0; font-size: 0.8rem; opacity: 0.5;">${escapeHtml(fb.parameter_description || 'Criterio específico evaluado')}</p>
                            </div>
                            <div style="background: rgba(255,255,255,0.05); padding: 4px 12px; border-radius: 20px; font-weight: 700; color: ${fbScoreColor}; font-size: 0.9rem;">
                                ${fb.score}%
                            </div>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            ${fb.strengths ? `
                            <div style="background: rgba(0,255,136,0.05); border: 1px solid rgba(0,255,136,0.1); border-radius: 12px; padding: 16px;">
                                <div style="display: flex; align-items: center; margin-bottom: 6px; color: #00ff88; font-weight: 600; font-size: 0.85rem;">
                                    <i class="fas fa-check-circle" style="margin-right: 6px;"></i> LO QUE HAS HECHO MUY BIEN
                                </div>
                                <p style="margin: 0; font-size: 0.92rem; line-height: 1.5; color: rgba(255,255,255,0.85);">${escapeHtml(fb.strengths)}</p>
                            </div>
                            ` : ''}

                            ${fb.improvements ? `
                            <div style="background: rgba(255,209,102,0.05); border: 1px solid rgba(255,209,102,0.1); border-radius: 12px; padding: 16px;">
                                <div style="display: flex; align-items: center; margin-bottom: 6px; color: #ffd166; font-weight: 600; font-size: 0.85rem;">
                                    <i class="fas fa-arrow-up" style="margin-right: 6px;"></i> EN ESTO PUEDES MEJORAR
                                </div>
                                <p style="margin: 0; font-size: 0.92rem; line-height: 1.5; color: rgba(255,255,255,0.85);">${escapeHtml(fb.improvements)}</p>
                            </div>
                            ` : ''}
                            
                            ${fb.summary ? `
                            <div style="margin-top: 4px; padding-top: 12px; border-top: 1px dashed rgba(255,255,255,0.1); font-size: 0.85rem; font-style: italic; opacity: 0.6;">
                                <i class="fas fa-quote-left" style="margin-right: 6px; font-size: 0.7rem;"></i> ${escapeHtml(fb.summary)}
                            </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            });
        }
        
        html += `
                </div>
                ${(summary && summary.status === 'completed') ? `
                <div style="padding: 20px 32px; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.05); text-align: center;">
                    <p style="margin: 0; font-size: 0.85rem; opacity: 0.6;"><i class="fas fa-lightbulb" style="color: #ffd166; margin-right: 6px;"></i> Recuerda que puedes aplicar estas mejoras, eliminar tu intento actual, y volver a subir el archivo las veces que consideres necesario.</p>
                </div>
                ` : ''}
            </div>
        </div>`;

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
