/* ═══════════════════════════════════════════════════
   SeminarIA — Suggestions Module
   Create, list, and vote on suggestions via API
   ═══════════════════════════════════════════════════ */

const SeminariaSuggestions = (function () {
    'use strict';

    const sugForm = document.getElementById('suggestion-form');
    const sugList = document.getElementById('suggestions-list');

    // ═══════════════ LOAD SUGGESTIONS ═══════════════
    async function load() {
        if (!sugList) return;

        try {
            const data = await SeminariaAPI.get('/suggestions');
            renderSuggestions(data.suggestions);
        } catch (err) {
            console.error('Error loading suggestions:', err);
        }
    }

    /**
     * Render suggestions list from API data
     */
    function renderSuggestions(suggestions) {
        if (!sugList) return;
        sugList.innerHTML = '';

        suggestions.forEach(sug => {
            const card = createSuggestionCard(sug);
            sugList.appendChild(card);
        });

        // Animate if GSAP available
        if (typeof gsap !== 'undefined') {
            gsap.fromTo('.suggestion-card', { opacity: 0, y: 25, scale: 0.96 }, {
                opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.1, ease: 'power3.out'
            });
        }
    }

    /**
     * Create a suggestion card DOM element
     */
    function createSuggestionCard(sug) {
        const user = SeminariaAuth.getUser();
        const isAdmin = user && user.role === 'admin';
        const isOwner = user && sug.author_id === user.id;

        const catClass = `cat-${sug.category}`;
        const catLabel = {
            contenido: 'Contenido',
            metodologia: 'Metodología',
            recursos: 'Recursos',
            organizacion: 'Organización',
            otro: 'Otro'
        }[sug.category] || 'Otro';

        const timeAgo = getTimeAgo(new Date(sug.created_at));

        // Delete button for owner or admin
        const deleteBtn = (isOwner || isAdmin)
            ? `<button class="btn-icon btn-delete-sug" data-sug-id="${sug.id}" title="Eliminar"><i class="fas fa-trash-alt"></i></button>`
            : '';

        const card = document.createElement('div');
        card.className = 'suggestion-card glass-card';
        card.innerHTML = `
            <div class="sug-header">
                <span class="sug-category ${catClass}">${catLabel}</span>
                <div style="display: flex; align-items: center; gap: 10px;">
                    ${deleteBtn}
                    <span class="sug-votes${sug.user_voted ? ' voted' : ''}" data-sug-id="${sug.id}">
                        <i class="fas fa-thumbs-up"></i> <span class="vote-count">${sug.votes}</span>
                    </span>
                </div>
            </div>
            <p class="sug-text">"${escapeHtml(sug.content)}"</p>
            <div class="sug-footer">
                <span class="sug-author"><i class="fas fa-user-circle"></i> ${escapeHtml(sug.author_name)}</span>
                <span class="sug-date">${timeAgo}</span>
            </div>
        `;

        return card;
    }

    // ═══════════════ DELETE HANDLER ═══════════════
    document.addEventListener('click', async (e) => {
        const delBtn = e.target.closest('.btn-delete-sug');
        if (!delBtn) return;

        if (!confirm('¿Eliminar esta sugerencia?')) return;

        try {
            await SeminariaAPI.del(`/suggestions/${delBtn.dataset.sugId}`);
            SeminariaToast.success('Sugerencia eliminada');
            await load();
        } catch (err) {
            SeminariaToast.error(err.error || 'Error al eliminar');
        }
    });

    // ═══════════════ VOTE HANDLER (Event Delegation) ═══════════════
    document.addEventListener('click', async (e) => {
        const voteBtn = e.target.closest('.sug-votes[data-sug-id]');
        if (!voteBtn) return;

        const sugId = voteBtn.dataset.sugId;

        try {
            const data = await SeminariaAPI.post(`/suggestions/${sugId}/vote`);
            const countEl = voteBtn.querySelector('.vote-count');
            if (countEl) countEl.textContent = data.votes;

            if (data.action === 'added') {
                voteBtn.classList.add('voted');
                voteBtn.style.color = 'var(--primary)';
            } else {
                voteBtn.classList.remove('voted');
                voteBtn.style.color = '';
            }

            if (typeof gsap !== 'undefined') {
                gsap.fromTo(voteBtn, { scale: 1.3 }, { scale: 1, duration: 0.3, ease: 'back.out(2)' });
            }
        } catch (err) {
            SeminariaToast.error(err.error || 'Error al votar');
        }
    });

    // ═══════════════ SUBMIT SUGGESTION ═══════════════
    if (sugForm) {
        sugForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const content = document.getElementById('sug-text')?.value?.trim();
            const category = document.getElementById('sug-category')?.value || 'otro';

            if (!content || content.length < 5) {
                SeminariaToast.warning('Escribe al menos 5 caracteres en tu sugerencia');
                return;
            }

            const btn = document.getElementById('btn-submit-sug');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

            try {
                await SeminariaAPI.post('/suggestions', { category, content });
                SeminariaToast.success('¡Sugerencia enviada correctamente!');
                sugForm.reset();

                // Reload suggestions list
                await load();
            } catch (err) {
                SeminariaToast.error(err.error || 'Error al enviar sugerencia');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Sugerencia';
            }
        });
    }

    /**
     * Time ago helper
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
     * XSS protection
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    return { load };
})();
