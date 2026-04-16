/* ═══════════════════════════════════════════════════
   SeminarIA — Dashboard Module
   Loads real metrics and activity from the API
   ═══════════════════════════════════════════════════ */

const SeminariaDashboard = (function () {
    'use strict';

    /**
     * Load dashboard data from API and update the UI
     */
    async function load() {
        try {
            const data = await SeminariaAPI.get('/dashboard');
            const user = SeminariaAuth.getUser();

            if (user && user.role === 'admin') {
                renderAdminMetrics(data.metrics);
                renderActivity(data.activity || []);
                // Load deliverables panel
                if (typeof SeminariaDeliverables !== 'undefined') {
                    SeminariaDeliverables.load();
                }
            } else {
                renderStudentMetrics(data.metrics);
                loadStudentUpcoming();
            }
        } catch (err) {
            console.error('Dashboard load error:', err);
        }
    }

    /**
     * Render admin dashboard metrics
     */
    function renderAdminMetrics(metrics) {
        setMetric('metric-sesiones', metrics.sessions_completed);
        setMetric('metric-evaluaciones', metrics.total_evaluations);
        setMetric('metric-satisfaccion', metrics.satisfaction_percentage, '%');
        setMetric('metric-sugerencias', metrics.active_suggestions);
    }

    /**
     * Render student dashboard metrics
     */
    function renderStudentMetrics(metrics) {
        // Find student metric cards dynamically by their label text
        const metricCards = document.querySelectorAll('.student-only .metric-value');
        const values = [
            metrics.evaluations_sent,
            metrics.suggestions_made,
            metrics.files_uploaded,
            metrics.pending_sessions
        ];
        metricCards.forEach((el, i) => {
            if (values[i] !== undefined) {
                el.setAttribute('data-count', values[i]);
                el.textContent = '0'; // Reset for animation
            }
        });
    }

    /**
     * Set a metric card's data-count attribute
     */
    function setMetric(cardId, value, suffix) {
        const card = document.getElementById(cardId);
        if (!card) return;
        const valueEl = card.querySelector('.metric-value');
        if (valueEl) {
            valueEl.setAttribute('data-count', value || 0);
            if (suffix) valueEl.setAttribute('data-suffix', suffix);
            valueEl.textContent = '0'; // Reset for GSAP animation
        }
    }

    /**
     * Render recent activity list from API data
     */
    function renderActivity(activity) {
        const list = document.querySelector('.admin-only .activity-list');
        if (!list || activity.length === 0) return;

        list.innerHTML = '';

        activity.forEach(item => {
            const iconClass = item.type === 'evaluation' ? 'fa-check-circle' : 'fa-comment-dots';
            const iconColor = item.type === 'evaluation' ? '#00ff88' : '#00c9ff';
            const badgeClass = item.type === 'evaluation' ? 'badge-success' : 'badge-info';
            const badgeText = item.type === 'evaluation' ? 'Evaluación' : 'Sugerencia';
            const timeAgo = getTimeAgo(new Date(item.date));

            const el = document.createElement('div');
            el.className = 'activity-item glass-card';
            el.innerHTML = `
                <div class="activity-icon" style="--accent: ${iconColor};">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div class="activity-info">
                    <span class="activity-title">${escapeHtml(item.title)}</span>
                    <span class="activity-meta">${escapeHtml(item.actor)} — ${timeAgo}</span>
                </div>
                <span class="activity-badge ${badgeClass}">${badgeText}</span>
            `;
            list.appendChild(el);
        });
    }

    /**
     * Convert date to "time ago" string
     */
    function getTimeAgo(date) {
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
        if (seconds < 60) return 'Hace un momento';
        if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
        if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} horas`;
        if (seconds < 604800) return `Hace ${Math.floor(seconds / 86400)} días`;
        return date.toLocaleDateString('es-ES');
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    /**
     * Load upcoming deadlines for student dashboard
     */
    async function loadStudentUpcoming() {
        const listEl = document.getElementById('student-upcoming-list');
        if (!listEl) return;

        try {
            const [delData, sessData] = await Promise.all([
                SeminariaAPI.get('/deliverables'),
                SeminariaAPI.get('/sessions')
            ]);

            const now = new Date();
            const items = [];

            // Pending deliverables
            (delData.deliverables || []).forEach(d => {
                const deadline = new Date(d.deadline);
                if (!d.submission_id && deadline > now) {
                    items.push({
                        type: 'entrega',
                        title: d.title,
                        deadline,
                        icon: 'fa-file-upload',
                        color: '#ffd166'
                    });
                }
            });

            // Open sessions to evaluate
            (sessData.sessions || []).forEach(s => {
                const deadline = s.eval_deadline ? new Date(s.eval_deadline) : null;
                if (deadline && deadline > now) {
                    items.push({
                        type: 'evaluación',
                        title: `Sesión ${s.session_number}: ${s.title}`,
                        deadline,
                        icon: 'fa-clipboard-check',
                        color: '#00c9ff'
                    });
                }
            });

            // Sort by nearest deadline
            items.sort((a, b) => a.deadline - b.deadline);

            if (items.length === 0) {
                listEl.innerHTML = `
                    <div class="glass-card" style="padding: 32px; text-align: center;">
                        <i class="fas fa-check-circle" style="font-size: 32px; opacity: 0.3; margin-bottom: 10px; color: var(--primary);"></i>
                        <p style="opacity: 0.5;">No tienes plazos próximos. ¡Estás al día!</p>
                    </div>
                `;
                return;
            }

            listEl.innerHTML = '';
            items.slice(0, 5).forEach(item => {
                const diff = item.deadline.getTime() - now.getTime();
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const timeStr = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
                const urgent = days < 2;

                const el = document.createElement('div');
                el.className = 'upcoming-item glass-card';
                el.innerHTML = `
                    <div class="upcoming-icon" style="color: ${item.color};"><i class="fas ${item.icon}"></i></div>
                    <div class="upcoming-info">
                        <span class="upcoming-title">${escapeHtml(item.title)}</span>
                        <span class="upcoming-type">${item.type === 'entrega' ? 'Entrega pendiente' : 'Evaluación pendiente'}</span>
                    </div>
                    <div class="upcoming-deadline ${urgent ? 'upcoming-urgent' : ''}">
                        <i class="fas fa-hourglass-half"></i> ${timeStr}
                    </div>
                `;
                listEl.appendChild(el);
            });

            if (typeof gsap !== 'undefined') {
                gsap.fromTo('.upcoming-item', { opacity: 0, x: -15 }, {
                    opacity: 1, x: 0, duration: 0.4, stagger: 0.08, ease: 'power2.out'
                });
            }
        } catch (err) {
            console.error('Upcoming load error:', err);
        }
    }

    return { load };
})();
