/* ═══════════════════════════════════════════════════
   SeminarIA — Analysis Module
   Loads evaluation analysis data from API and renders charts
   ═══════════════════════════════════════════════════ */

const SeminariaAnalysis = (function () {
    'use strict';

    const barColors = ['#00ff88', '#00e5a0', '#00c9ff', '#00ff88', '#00e5a0', '#00c9ff', '#00ff88', '#00e5a0', '#00c9ff', '#00ff88', '#00e5a0', '#00c9ff'];

    async function load() {
        try {
            const data = await SeminariaAPI.get('/evaluations/analysis');
            renderBarChart(data.per_session);
            renderDonut(data.overall);
            renderTrend(data.per_session);
        } catch (err) {
            console.error('Analysis load error:', err);
        }
    }

    function renderBarChart(sessions) {
        const container = document.getElementById('chart-sessions');
        if (!container) return;

        const evaluated = sessions.filter(s => s.eval_count > 0);

        if (evaluated.length === 0) {
            container.innerHTML = '<p style="opacity: 0.4; text-align: center; padding: 32px;">Aún no hay evaluaciones registradas</p>';
            return;
        }

        container.innerHTML = '';
        evaluated.forEach((s, i) => {
            const value = Math.round(parseFloat(s.avg_rating) * 20); // 1-5 scale → 0-100%
            const el = document.createElement('div');
            el.className = 'bar-item';
            el.innerHTML = `
                <span class="bar-label">Ses. ${s.session_number}</span>
                <div class="bar-track"><div class="bar-fill" data-value="${value}" style="--bar-color: ${barColors[i % barColors.length]};"></div></div>
                <span class="bar-value">${parseFloat(s.avg_rating).toFixed(1)}</span>
            `;
            container.appendChild(el);
        });

        // Animate bars
        if (typeof gsap !== 'undefined') {
            gsap.fromTo('.bar-fill', { width: '0%' }, {
                width: (i, el) => el.dataset.value + '%',
                duration: 1, stagger: 0.1, ease: 'power3.out', delay: 0.2
            });
        }
    }

    function renderDonut(overall) {
        if (!overall || overall.total_evaluations === 0) return;

        const scores = {
            contenido: parseFloat(overall.avg_contenido),
            docente: parseFloat(overall.avg_docente),
            material: parseFloat(overall.avg_material),
            participacion: parseFloat(overall.avg_participacion)
        };

        const total = scores.contenido + scores.docente + scores.material + scores.participacion;
        const avg = (total / 4).toFixed(1);

        // Update center value
        const avgEl = document.getElementById('donut-avg');
        if (avgEl) avgEl.textContent = avg;

        // Update legend values
        document.getElementById('legend-contenido').textContent = scores.contenido.toFixed(1);
        document.getElementById('legend-docente').textContent = scores.docente.toFixed(1);
        document.getElementById('legend-material').textContent = scores.material.toFixed(1);
        document.getElementById('legend-participacion').textContent = scores.participacion.toFixed(1);

        // Update donut segments proportionally
        const pct = {
            contenido: (scores.contenido / total) * 100,
            docente: (scores.docente / total) * 100,
            material: (scores.material / total) * 100,
            participacion: (scores.participacion / total) * 100
        };

        let offset = 25; // start offset
        const segments = [
            { id: 'donut-contenido', pct: pct.contenido },
            { id: 'donut-docente', pct: pct.docente },
            { id: 'donut-material', pct: pct.material },
            { id: 'donut-participacion', pct: pct.participacion }
        ];

        segments.forEach(seg => {
            const el = document.getElementById(seg.id);
            if (el) {
                el.setAttribute('stroke-dasharray', `${seg.pct} ${100 - seg.pct}`);
                el.setAttribute('stroke-dashoffset', `${offset}`);
                offset -= seg.pct;
            }
        });
    }

    function renderTrend(sessions) {
        const container = document.getElementById('trend-line');
        if (!container) return;

        const evaluated = sessions.filter(s => s.eval_count > 0);

        if (evaluated.length === 0) {
            container.innerHTML = '<p style="opacity: 0.4; text-align: center; padding: 32px;">Aún no hay datos de tendencia</p>';
            return;
        }

        container.innerHTML = '';

        const maxVal = 5; // max rating
        const count = evaluated.length;

        evaluated.forEach((s, i) => {
            const val = parseFloat(s.avg_rating);
            const x = count === 1 ? 50 : (i / (count - 1)) * 100;
            const y = 100 - ((val / maxVal) * 100); // invert for CSS (0% = top)
            const color = val >= 4 ? '#00ff88' : val >= 3 ? '#00e5a0' : '#00c9ff';

            const point = document.createElement('div');
            point.className = 'trend-point';
            point.setAttribute('data-month', `Ses. ${s.session_number}`);
            point.setAttribute('data-value', (val * 20).toFixed(0));
            point.style.cssText = `--x: ${x}%; --y: ${y}%; --color: ${color};`;
            container.appendChild(point);
        });

        // Animate points
        if (typeof gsap !== 'undefined') {
            gsap.fromTo('.trend-point', { scale: 0, opacity: 0 }, {
                scale: 1, opacity: 1, duration: 0.4, stagger: 0.1, ease: 'back.out(2)', delay: 0.3
            });
        }
    }

    // ═══════════════ STRENGTHS & WEAKNESSES ═══════════════
    async function loadStrengths() {
        const strengthsList = document.getElementById('strengths-list');
        const weaknessesList = document.getElementById('weaknesses-list');
        const emptyState = document.getElementById('strengths-empty');
        const grid = document.getElementById('strengths-grid');

        try {
            const data = await SeminariaAPI.get('/evaluations/analysis');
            const overall = data.overall;

            if (!overall || parseInt(overall.total_evaluations) === 0) {
                if (grid) grid.style.display = 'none';
                if (emptyState) emptyState.style.display = 'block';
                return;
            }

            if (grid) grid.style.display = '';
            if (emptyState) emptyState.style.display = 'none';

            // Build category scores
            const categories = [
                { name: 'Contenido', score: parseFloat(overall.avg_contenido), color: '#00ff88' },
                { name: 'Desempeño Docente', score: parseFloat(overall.avg_docente), color: '#00c9ff' },
                { name: 'Material Didáctico', score: parseFloat(overall.avg_material), color: '#00e5a0' },
                { name: 'Participación', score: parseFloat(overall.avg_participacion), color: '#ffd166' }
            ];

            // Sort: highest = strengths, lowest = weaknesses
            const sorted = [...categories].sort((a, b) => b.score - a.score);
            const strengths = sorted.filter(c => c.score >= 5);
            const weaknesses = sorted.filter(c => c.score < 5);

            // If all are >= 5, split: top 2 strengths, bottom 2 areas to improve
            const displayStrengths = strengths.length > 0 ? strengths : sorted.slice(0, 2);
            const displayWeaknesses = weaknesses.length > 0 ? weaknesses : sorted.slice(2);

            renderStrengthItems(strengthsList, displayStrengths, false);
            renderStrengthItems(weaknessesList, displayWeaknesses, true);

        } catch (err) {
            console.error('Strengths load error:', err);
        }
    }

    function renderStrengthItems(container, items, isWeakness) {
        if (!container) return;
        container.innerHTML = '';

        if (items.length === 0) {
            container.innerHTML = '<p style="opacity: 0.4; padding: 20px; text-align: center;">Sin datos aún</p>';
            return;
        }

        items.forEach((item, i) => {
            const pct = (item.score / 10) * 100;
            const fillColor = isWeakness ? '#ff6b9d' : item.color;
            const el = document.createElement('div');
            el.className = 'strength-item glass-card';
            el.innerHTML = `
                <div class="strength-rank ${isWeakness ? 'weakness-rank' : ''}">${i + 1}</div>
                <div class="strength-info">
                    <span class="strength-title">${item.name}</span>
                    <div class="strength-bar"><div class="strength-fill" data-value="${pct}" style="--fill-color: ${fillColor};"></div></div>
                    <span class="strength-mentions">Promedio: ${item.score.toFixed(1)} / 10</span>
                </div>
            `;
            container.appendChild(el);
        });

        // Animate bars
        if (typeof gsap !== 'undefined') {
            gsap.fromTo(container.querySelectorAll('.strength-fill'), { width: '0%' }, {
                width: (i, el) => el.dataset.value + '%',
                duration: 1, stagger: 0.15, ease: 'power3.out', delay: 0.2
            });
        }
    }

    return { load, loadStrengths };
})();
