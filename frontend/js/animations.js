/* ═══════════════════════════════════════════════════
   SeminarIA — Animations Module
   GSAP, Liquid Glass, Canvas Particles, Section Animations
   ═══════════════════════════════════════════════════ */

const SeminariaAnimations = (function () {
    'use strict';

    // ─── Liquid Glass ───
    const liquidGlass = document.getElementById('liquid-glass');
    const particles = liquidGlass ? liquidGlass.querySelectorAll('.particle') : [];
    let currentX = 0, currentY = 0;
    let targetX = 0, targetY = 0;
    let time = 0;
    let isShattered = false;
    let glassAnimFrame;

    // ─── Canvas Particles ───
    const canvas = document.getElementById('canvas-particles');
    let ctx, particlesArray = [], canvasAnimId;
    let mouse = { x: undefined, y: undefined, radius: 100 };

    // ═══════════════ CANVAS PARTICLES (Login Background) ═══════════════

    function initCanvas() {
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        resizeCanvas();

        window.addEventListener('mousemove', (e) => { mouse.x = e.x; mouse.y = e.y; });
        window.addEventListener('mouseout', () => { mouse.x = undefined; mouse.y = undefined; });
        window.addEventListener('resize', () => { resizeCanvas(); createParticles(); });

        createParticles();
        animateCanvas();
    }

    function resizeCanvas() {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        mouse.radius = (canvas.height / 90) * (canvas.width / 90);
    }

    class CanvasParticle {
        constructor(x, y, dx, dy, size) {
            this.x = x; this.y = y; this.dx = dx; this.dy = dy; this.size = size;
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 255, 136, 0.25)';
            ctx.fill();
        }
        update() {
            if (this.x > canvas.width || this.x < 0) this.dx = -this.dx;
            if (this.y > canvas.height || this.y < 0) this.dy = -this.dy;
            if (mouse.x !== undefined) {
                const dx = mouse.x - this.x;
                const dy = mouse.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < mouse.radius + this.size) {
                    if (mouse.x < this.x && this.x < canvas.width - this.size * 10) this.x += 2;
                    if (mouse.x > this.x && this.x > this.size * 10) this.x -= 2;
                    if (mouse.y < this.y && this.y < canvas.height - this.size * 10) this.y += 2;
                    if (mouse.y > this.y && this.y > this.size * 10) this.y -= 2;
                }
            }
            this.x += this.dx;
            this.y += this.dy;
            this.draw();
        }
    }

    function createParticles() {
        particlesArray = [];
        if (!canvas) return;
        const count = Math.min((canvas.width * canvas.height) / 12000, 120);
        for (let i = 0; i < count; i++) {
            const size = Math.random() * 2.5 + 0.5;
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const dx = (Math.random() - 0.5) * 0.8;
            const dy = (Math.random() - 0.5) * 0.8;
            particlesArray.push(new CanvasParticle(x, y, dx, dy, size));
        }
    }

    function connectParticles() {
        for (let a = 0; a < particlesArray.length; a++) {
            for (let b = a + 1; b < particlesArray.length; b++) {
                const dx = particlesArray[a].x - particlesArray[b].x;
                const dy = particlesArray[a].y - particlesArray[b].y;
                const dist = dx * dx + dy * dy;
                if (dist < (canvas.width / 8) * (canvas.height / 8)) {
                    const opacity = 1 - (dist / 25000);
                    ctx.strokeStyle = `rgba(0, 255, 136, ${Math.max(0, opacity * 0.15)})`;
                    ctx.lineWidth = 0.6;
                    ctx.beginPath();
                    ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
                    ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
                    ctx.stroke();
                }
            }
        }
    }

    function animateCanvas() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < particlesArray.length; i++) {
            particlesArray[i].update();
        }
        connectParticles();
        canvasAnimId = requestAnimationFrame(animateCanvas);
    }

    function stopCanvas() {
        if (canvasAnimId) cancelAnimationFrame(canvasAnimId);
    }

    function restartCanvas() {
        if (canvas) {
            resizeCanvas();
            createParticles();
            animateCanvas();
        }
    }

    // Init canvas on load
    initCanvas();

    // ═══════════════ LIQUID GLASS EFFECT ═══════════════

    document.addEventListener('mousemove', (e) => {
        if (!liquidGlass) return;
        const rect = liquidGlass.closest('.hero-area');
        if (!rect) return;
        const bounds = rect.getBoundingClientRect();
        targetX = (bounds.left + bounds.width / 2 - e.clientX) / 30;
        targetY = (bounds.top + bounds.height / 2 - e.clientY) / 30;
    });

    function animateGlass() {
        if (isShattered || !liquidGlass) return;
        currentX += (targetX - currentX) * 0.08;
        currentY += (targetY - currentY) * 0.08;
        liquidGlass.style.transform = `rotateY(${currentX}deg) rotateX(${currentY}deg)`;
        time += 0.025;
        particles.forEach((p, i) => {
            const speed = (i + 1) * 1.1;
            const floatX = Math.sin(time * 0.5 + i * 8) * 12;
            const floatY = Math.cos(time * 0.35 + i * 8) * 12;
            p.style.transform = `translate(${-currentX * speed + floatX}px, ${-currentY * speed + floatY}px)`;
        });
        glassAnimFrame = requestAnimationFrame(animateGlass);
    }

    if (liquidGlass) {
        animateGlass();
        liquidGlass.addEventListener('click', () => {
            if (isShattered) return;
            isShattered = true;
            cancelAnimationFrame(glassAnimFrame);
            liquidGlass.style.transform = 'scale(1)';
            liquidGlass.classList.add('shattered');

            const rect = liquidGlass.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            for (let i = 0; i < 18; i++) {
                const shard = document.createElement('div');
                shard.classList.add('shard');
                const size = Math.random() * 28 + 8;
                shard.style.width = `${size}px`;
                shard.style.height = `${size}px`;
                shard.style.left = `${centerX}px`;
                shard.style.top = `${centerY}px`;
                shard.style.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
                const angle = Math.random() * Math.PI * 2;
                const velocity = Math.random() * 350 + 80;
                const tx = Math.cos(angle) * velocity;
                const ty = Math.sin(angle) * velocity;
                const rot = Math.random() * 720;
                shard.animate([
                    { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1 },
                    { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) rotate(${rot}deg)`, opacity: 0 }
                ], { duration: 900, easing: 'cubic-bezier(0.25, 1, 0.5, 1)', fill: 'forwards' });
                document.body.appendChild(shard);
                setTimeout(() => shard.remove(), 900);
            }

            setTimeout(() => {
                isShattered = false;
                liquidGlass.classList.remove('shattered');
                liquidGlass.style.transform = '';
                animateGlass();
            }, 2500);
        });
    }


    // ═══════════════ GSAP SECTION ANIMATIONS ═══════════════

    function animateSection(sectionId) {
        if (typeof gsap === 'undefined') return;
        switch (sectionId) {
            case 'dashboard': animateDashboard(); break;
            case 'evaluacion': animateEvaluacion(); break;
            case 'analisis': animateAnalisis(); break;
            case 'fortalezas': animateFortalezas(); break;
            case 'sugerencias': animateSugerencias(); break;
            case 'config': animateConfig(); break;
            case 'trabajos': animateTrabajos(); break;
        }
    }

    function animateDashboard() {
        if (typeof gsap === 'undefined') return;
        document.querySelectorAll('.metric-value[data-count]').forEach(el => {
            const target = parseInt(el.dataset.count);
            const suffix = el.dataset.suffix || '';
            gsap.fromTo(el, { innerText: 0 }, {
                innerText: target,
                duration: 1.8,
                ease: 'power2.out',
                snap: { innerText: 1 },
                onUpdate: function () {
                    el.textContent = Math.round(parseFloat(el.textContent)) + suffix;
                }
            });
        });
        gsap.fromTo('.metric-card', { opacity: 0, y: 30, scale: 0.95 }, {
            opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.12, ease: 'power3.out'
        });
        gsap.fromTo('.activity-item', { opacity: 0, x: -20 }, {
            opacity: 1, x: 0, duration: 0.5, stagger: 0.1, delay: 0.6, ease: 'power2.out'
        });
    }

    function animateEvaluacion() {
        if (typeof gsap === 'undefined') return;
        gsap.fromTo('.eval-form-container', { opacity: 0, y: 30 }, {
            opacity: 1, y: 0, duration: 0.6, ease: 'power3.out'
        });
        gsap.fromTo('#section-evaluacion .form-group', { opacity: 0, y: 15 }, {
            opacity: 1, y: 0, duration: 0.4, stagger: 0.06, delay: 0.2, ease: 'power2.out'
        });
    }

    function animateAnalisis() {
        if (typeof gsap === 'undefined') return;
        document.querySelectorAll('.bar-fill').forEach(bar => {
            const value = bar.dataset.value;
            gsap.fromTo(bar, { width: '0%' }, {
                width: value + '%', duration: 1.2, delay: 0.4, ease: 'power3.out'
            });
        });
        gsap.fromTo('.chart-card', { opacity: 0, y: 30 }, {
            opacity: 1, y: 0, duration: 0.6, stagger: 0.15, ease: 'power3.out'
        });
        document.querySelectorAll('.trend-point').forEach((point, i) => {
            gsap.to(point, {
                delay: 0.8 + i * 0.1, duration: 0.4,
                onStart: () => point.classList.add('visible'),
                ease: 'back.out(1.7)'
            });
        });
        gsap.fromTo('.trend-card', { opacity: 0, y: 30 }, {
            opacity: 1, y: 0, duration: 0.6, delay: 0.3, ease: 'power3.out'
        });
    }

    function animateFortalezas() {
        if (typeof gsap === 'undefined') return;
        document.querySelectorAll('.strength-fill').forEach((fill, i) => {
            const value = fill.dataset.value;
            gsap.fromTo(fill, { width: '0%' }, {
                width: value + '%', duration: 1, delay: 0.3 + i * 0.1, ease: 'power3.out'
            });
        });
        gsap.fromTo('.strength-item', {
            opacity: 0,
            x: function (i) {
                const el = document.querySelectorAll('.strength-item')[i];
                return el && el.closest('.strength-column') === document.querySelector('.strength-column') ? -20 : 20;
            }
        }, {
            opacity: 1, x: 0, duration: 0.5, stagger: 0.08, delay: 0.2, ease: 'power2.out'
        });
    }

    function animateSugerencias() {
        if (typeof gsap === 'undefined') return;
        gsap.fromTo('.suggestion-input', { opacity: 0, y: 20 }, {
            opacity: 1, y: 0, duration: 0.5, ease: 'power3.out'
        });
        gsap.fromTo('.suggestion-card', { opacity: 0, y: 25, scale: 0.96 }, {
            opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.1, delay: 0.2, ease: 'power3.out'
        });
    }

    function animateConfig() {
        if (typeof gsap === 'undefined') return;
        gsap.fromTo('.config-card', { opacity: 0, y: 30 }, {
            opacity: 1, y: 0, duration: 0.6, stagger: 0.15, ease: 'power3.out'
        });
    }

    function animateTrabajos() {
        if (typeof gsap === 'undefined') return;
        gsap.fromTo('.upload-area', { opacity: 0, y: 20 }, {
            opacity: 1, y: 0, duration: 0.5, ease: 'power3.out'
        });
        gsap.fromTo('.trabajo-item', { opacity: 0, x: -20 }, {
            opacity: 1, x: 0, duration: 0.5, stagger: 0.1, delay: 0.3, ease: 'power2.out'
        });
    }


    // ═══════════════ PUBLIC API ═══════════════
    return {
        stopCanvas,
        restartCanvas,
        animateSection,
        animateDashboard
    };
})();
