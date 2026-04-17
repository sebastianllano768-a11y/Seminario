/* ═══════════════════════════════════════════════════
   SeminarIA — File Uploads Module
   Real file upload via API + list uploaded files
   ═══════════════════════════════════════════════════ */

const SeminariaUploads = (function () {
    'use strict';

    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const trabajosList = document.querySelector('.trabajos-list');
    const studentDelList = document.getElementById('student-deliverables-list');

    const VALID_TYPES = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/msword',
        'application/vnd.ms-powerpoint'
    ];

    const MAX_SIZE = 25 * 1024 * 1024; // 25MB

    // ═══════════════ DRAG & DROP / CLICK HANDLERS ═══════════════
    if (uploadZone && fileInput) {
        uploadZone.addEventListener('click', () => fileInput.click());

        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('drag-over');
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('drag-over');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                handleFileUpload(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                handleFileUpload(fileInput.files[0]);
            }
        });
    }

    // ═══════════════ UPLOAD FILE TO API ═══════════════
    async function handleFileUpload(file) {
        // Client-side validation
        if (!VALID_TYPES.includes(file.type)) {
            SeminariaToast.warning('Formato no soportado. Usa PDF, DOCX o PPTX');
            return;
        }

        if (file.size > MAX_SIZE) {
            SeminariaToast.warning('El archivo excede el límite de 25MB');
            return;
        }

        // Show loading state on upload zone
        const originalContent = uploadZone.innerHTML;
        uploadZone.innerHTML = `
            <i class="fas fa-spinner fa-spin upload-icon"></i>
            <h3>Subiendo "${file.name}"...</h3>
            <p>${(file.size / (1024 * 1024)).toFixed(1)} MB</p>
        `;

        try {
            const data = await SeminariaAPI.uploadFile('/uploads', file);
            SeminariaToast.success(`"${file.name}" subido correctamente`);

            // Reload the file list
            await loadFiles();

        } catch (err) {
            SeminariaToast.error(err.error || 'Error al subir el archivo');
        } finally {
            uploadZone.innerHTML = originalContent;
            // Re-bind click since innerHTML was replaced
            uploadZone.onclick = () => fileInput.click();
        }
    }

    // ═══════════════ LOAD FILES FROM API ═══════════════
    async function loadFiles() {
        if (!trabajosList) return;

        try {
            const data = await SeminariaAPI.get('/uploads');
            renderFiles(data.uploads);
        } catch (err) {
            console.error('Error loading files:', err);
        }
    }

    /**
     * Render file list from API data
     */
    function renderFiles(uploads) {
        if (!trabajosList) return;
        trabajosList.innerHTML = '';

        if (uploads.length === 0) {
            trabajosList.innerHTML = `
                <div class="glass-card" style="padding: 24px; text-align: center; color: var(--text-muted);">
                    <i class="fas fa-folder-open" style="font-size: 2rem; margin-bottom: 12px; opacity: 0.5;"></i>
                    <p>No hay trabajos subidos aún</p>
                </div>
            `;
            return;
        }

        uploads.forEach(upload => {
            const ext = upload.original_name.split('.').pop().toLowerCase();
            const iconClass = ext === 'pdf' ? 'fa-file-pdf'
                : (ext === 'pptx' || ext === 'ppt') ? 'fa-file-powerpoint'
                : 'fa-file-word';

            const sizeMB = (upload.size_bytes / (1024 * 1024)).toFixed(1);
            const date = new Date(upload.created_at).toLocaleDateString('es-ES', {
                day: 'numeric', month: 'short', year: 'numeric'
            });

            const statusMap = {
                en_revision: { class: 'status-review', icon: 'fa-clock', text: 'En revisión' },
                aprobado: { class: 'status-approved', icon: 'fa-check', text: 'Aprobado' },
                rechazado: { class: 'status-rejected', icon: 'fa-times', text: 'Rechazado' }
            };
            const status = statusMap[upload.status] || statusMap.en_revision;

            const item = document.createElement('div');
            item.className = 'trabajo-item glass-card';
            item.innerHTML = `
                <div class="trabajo-icon"><i class="fas ${iconClass}"></i></div>
                <div class="trabajo-info">
                    <span class="trabajo-name">${escapeHtml(upload.original_name)}</span>
                    <span class="trabajo-meta">${upload.user_name ? escapeHtml(upload.user_name) + ' — ' : ''}Subido: ${date} — ${sizeMB} MB</span>
                </div>
                <span class="trabajo-status ${status.class}"><i class="fas ${status.icon}"></i> ${status.text}</span>
            `;
            trabajosList.appendChild(item);
        });

        // Animate
        if (typeof gsap !== 'undefined') {
            gsap.fromTo('.trabajo-item', { opacity: 0, x: -20 }, {
                opacity: 1, x: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out'
            });
        }
    }

    /**
     * XSS protection
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    // ═══════════════ STUDENT DELIVERABLES ═══════════════
    let pollingInterval = null;

    async function loadStudentDeliverables() {
        if (!studentDelList) return;
        const user = SeminariaAuth.getUser();
        if (!user || user.role === 'admin') return;

        try {
            const data = await SeminariaAPI.get('/deliverables');
            renderStudentDeliverables(data.deliverables);
        } catch (err) {
            console.error('Error loading student deliverables:', err);
        }
    }

    function renderStudentDeliverables(deliverables) {
        if (!studentDelList) return;

        if (deliverables.length === 0) {
            studentDelList.innerHTML = `
                <div class="glass-card" style="padding: 48px; text-align: center;">
                    <i class="fas fa-inbox" style="font-size: 48px; opacity: 0.3; margin-bottom: 12px;"></i>
                    <p style="opacity: 0.5;">No hay entregas asignadas por ahora.</p>
                </div>
            `;
            return;
        }

        studentDelList.innerHTML = '';
        deliverables.forEach(del => {
            const now = new Date();
            const deadline = new Date(del.deadline);
            const isExpired = deadline < now;
            const hasSubmitted = !!del.submission_id;

            let statusBadge, statusIcon, cardAccent;
            if (hasSubmitted && !del.is_late) {
                statusBadge = '<span class="activity-badge badge-success"><i class="fas fa-check-circle"></i> Entregada a tiempo</span>';
                cardAccent = '#00ff88';
            } else if (hasSubmitted && del.is_late) {
                statusBadge = '<span class="activity-badge badge-warning"><i class="fas fa-exclamation-circle"></i> Entregada con retraso</span>';
                cardAccent = '#ffd166';
            } else if (isExpired) {
                statusBadge = '<span class="activity-badge badge-danger"><i class="fas fa-times-circle"></i> Plazo vencido</span>';
                cardAccent = '#ff6b9d';
            } else {
                statusBadge = '<span class="activity-badge badge-info"><i class="fas fa-clock"></i> Pendiente</span>';
                cardAccent = '#00c9ff';
            }

            const timeLeft = !isExpired && !hasSubmitted ? getTimeRemaining(deadline) : '';

            // Feedback section (neutral — no AI mention visible to student)
            let aiFeedbackHtml = '';
            if (hasSubmitted && del.ai_status === 'completed' && del.overall_score !== null) {
                const scoreColor = del.overall_score >= 70 ? '#00ff88' : del.overall_score >= 40 ? '#ffd166' : '#ff6b9d';
                aiFeedbackHtml = `
                    <div class="student-ai-feedback-summary" data-sub-id="${del.submission_id}">
                        <div class="student-ai-score" style="border-color: ${scoreColor};">
                            <span style="color: ${scoreColor};">${del.overall_score}</span>
                        </div>
                        <div class="student-ai-info">
                            <span style="font-weight: 600; font-size: 0.85rem;">Retroalimentaci\u00f3n de tu entrega</span>
                            <span style="opacity: 0.5; font-size: 0.78rem;">Toca para ver los resultados</span>
                        </div>
                        <i class="fas fa-chevron-right" style="opacity: 0.3;"></i>
                    </div>
                `;
            } else if (hasSubmitted && del.ai_status === 'pending') {
                aiFeedbackHtml = `
                    <div class="student-ai-feedback-summary" style="cursor: default; opacity: 0.6;">
                        <i class="fas fa-spinner fa-spin" style="color: var(--primary);"></i>
                        <span style="font-size: 0.82rem;">Analizando tu entrega, pronto tendr\u00e1s resultados...</span>
                    </div>
                `;
            } else if (hasSubmitted && del.ai_status === 'error') {
                aiFeedbackHtml = `
                    <div class="student-ai-feedback-summary" style="cursor: default; border-color: #ff6b9d;">
                        <i class="fas fa-exclamation-triangle" style="color: #ff6b9d;"></i>
                        <div class="student-ai-info">
                            <span style="font-size: 0.82rem; color: #ff6b9d;">Hubo un problema al analizar tu entrega.</span>
                            <span style="opacity: 0.5; font-size: 0.78rem;">Por favor, contacta con tu docente.</span>
                        </div>
                    </div>
                `;
            }

            const card = document.createElement('div');
            card.className = 'student-del-card glass-card';
            card.innerHTML = `
                <div class="student-del-accent" style="background: ${cardAccent};"></div>
                <div class="student-del-content">
                    <div class="student-del-header">
                        <h4>${escapeHtml(del.title)}</h4>
                        ${statusBadge}
                    </div>
                    ${del.description ? `<p class="student-del-desc">${escapeHtml(del.description)}</p>` : ''}
                    <div class="student-del-meta">
                        <span><i class="fas fa-calendar-alt"></i> Plazo: ${deadline.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })} — ${deadline.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                        ${timeLeft ? `<span class="student-del-countdown"><i class="fas fa-hourglass-half"></i> ${timeLeft}</span>` : ''}
                    </div>
                    ${hasSubmitted ? `
                        <div class="student-del-submitted" style="display:flex; justify-content:space-between; align-items:center;">
                            <div style="flex:1;">
                                <i class="fas fa-file-alt"></i>
                                <span>${escapeHtml(del.submitted_file)}</span>
                                <span class="student-del-submitted-date">Enviado: ${new Date(del.submitted_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} (Intento ${del.attempt_number || 1})</span>
                            </div>
                            ${!isExpired ? `
                                <button class="btn btn-danger btn-sm btn-delete-submission" data-sub-id="${del.submission_id}" title="Eliminar intento para volver a subir" style="margin-left:8px; padding: 4px 8px;">
                                    <i class="fas fa-redo-alt"></i>
                                </button>
                            ` : ''}
                        </div>
                        ${aiFeedbackHtml}
                    ` : (!isExpired ? `
                        <div class="student-del-upload">
                            ${(del.total_attempts > 0) ? `<div style="font-size: 0.8rem; color: var(--primary); margin-bottom: 8px;"><i class="fas fa-info-circle"></i> Puedes mejorar tu entrega tomando en cuenta la retroalimentación anterior.</div>` : ''}
                            <label class="btn btn-primary btn-sm student-del-upload-btn" data-del-id="${del.id}">
                                <i class="fas fa-upload"></i> Subir Entrega
                                <input type="file" hidden accept=".pdf,.docx,.pptx,.doc,.ppt,.xlsx,.xls" data-del-id="${del.id}" class="student-del-file-input">
                            </label>
                        </div>
                    ` : '')}
                </div>
            `;
            studentDelList.appendChild(card);
        });

        // Animate (only if not polling, to avoid annoying flashes every 5s)
        if (typeof gsap !== 'undefined' && !pollingInterval) {
            gsap.fromTo('.student-del-card', { opacity: 0, y: 20, scale: 0.97 }, {
                opacity: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.08, ease: 'power3.out'
            });
        }

        // Check if we need to poll for pending AI evaluations
        const hasPending = deliverables.some(del => !!del.submission_id && del.ai_status === 'pending');
        
        if (pollingInterval) {
            clearTimeout(pollingInterval);
            pollingInterval = null;
        }

        if (hasPending) {
            pollingInterval = setTimeout(() => {
                loadStudentDeliverables();
            }, 5000); // Poll every 5 seconds
        }
    }

    function getTimeRemaining(deadline) {
        const diff = deadline.getTime() - Date.now();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        if (days > 0) return `${days}d ${hours}h restantes`;
        if (hours > 0) return `${hours}h restantes`;
        const mins = Math.floor(diff / (1000 * 60));
        return `${mins} min restantes`;
    }

    // ═══════════════ VIEW AI FEEDBACK (Student) ═══════════════
    document.addEventListener('click', async (e) => {
        const fbSummary = e.target.closest('.student-ai-feedback-summary[data-sub-id]');
        if (!fbSummary) return;

        const subId = fbSummary.dataset.subId;
        try {
            const data = await SeminariaAPI.get(`/deliverables/submission/${subId}/feedback`);
            if (typeof SeminariaDeliverables !== 'undefined' && SeminariaDeliverables.showDetailedFeedbackModal) {
                const user = SeminariaAuth.getUser();
                SeminariaDeliverables.showDetailedFeedbackModal(data, user ? user.name : 'Mi Retroalimentación');
            }
        } catch (err) {
            SeminariaToast.error('Error al cargar retroalimentación');
        }
    });

    // ═══════════════ SUBMIT AND DELETE DELIVERABLE ═══════════════
    document.addEventListener('change', async (e) => {
        const input = e.target.closest('.student-del-file-input');
        if (!input || !input.files.length) return;

        const file = input.files[0];
        const delId = input.dataset.delId;

        if (file.size > MAX_SIZE) {
            SeminariaToast.warning('El archivo excede el límite de 25MB');
            return;
        }

        const btn = input.closest('.student-del-upload-btn');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo...';
            btn.style.pointerEvents = 'none';
        }

        try {
            const data = await SeminariaAPI.uploadFile(`/deliverables/${delId}/submit`, file);
            SeminariaToast.success(data.message || '¡Entrega enviada!');
            await loadStudentDeliverables();
        } catch (err) {
            SeminariaToast.error(err.error || 'Error al subir la entrega');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-upload"></i> Subir Entrega<input type="file" hidden accept=".pdf,.docx,.pptx,.doc,.ppt,.xlsx,.xls" data-del-id="' + delId + '" class="student-del-file-input">';
                btn.style.pointerEvents = '';
            }
        }
    });

    document.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.btn-delete-submission');
        if (deleteBtn) {
            if (!confirm('¿Eliminar esta entrega para volver a subir una nueva versión? Esta acción no se puede deshacer.')) return;
            
            const subId = deleteBtn.dataset.subId;
            deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            deleteBtn.style.pointerEvents = 'none';

            try {
                const res = await SeminariaAPI.del(`/deliverables/submission/${subId}`);
                SeminariaToast.success(res.message || 'Entrega eliminada.');
                await loadStudentDeliverables();
            } catch (err) {
                SeminariaToast.error(err.error || 'Error al eliminar');
                deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
                deleteBtn.style.pointerEvents = '';
            }
        }
    });

    // Combined load
    async function load() {
        await Promise.all([loadFiles(), loadStudentDeliverables()]);
    }

    return { loadFiles, load, loadStudentDeliverables };
})();
