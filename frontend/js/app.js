/* ═══════════════════════════════════════════════════
   SeminarIA — Main Application Module
   SPA Router, Section Navigation, Color Picker, Initialization
   ═══════════════════════════════════════════════════ */

const SeminariaApp = (function () {
    'use strict';

    // ─── DOM References ───
    const sidebar = document.getElementById('sidebar');
    const hamburger = document.getElementById('hamburger');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const mainContent = document.getElementById('main-content');
    const navLinks = document.querySelectorAll('.nav-link[data-section]');
    const sections = document.querySelectorAll('.page-section');

    // ═══════════════ SPA NAVIGATION ═══════════════
    function navigateTo(sectionId) {
        navLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.section === sectionId);
        });

        sections.forEach(section => {
            section.classList.toggle('active', section.id === `section-${sectionId}`);
        });

        // Close mobile sidebar
        if (sidebar) sidebar.classList.remove('mobile-open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');

        // Scroll to top
        if (mainContent) mainContent.scrollTop = 0;
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Load section data from API
        loadSectionData(sectionId);

        // Trigger animations
        requestAnimationFrame(() => {
            if (typeof SeminariaAnimations !== 'undefined') {
                SeminariaAnimations.animateSection(sectionId);
            }
        });
    }

    /**
     * Load data specific to each section
     */
    function loadSectionData(sectionId) {
        switch (sectionId) {
            case 'dashboard':
                if (typeof SeminariaDashboard !== 'undefined') SeminariaDashboard.load();
                break;
            case 'evaluacion':
                if (typeof SeminariaEvaluations !== 'undefined') SeminariaEvaluations.loadSessions();
                break;
            case 'analisis':
                if (typeof SeminariaAnalysis !== 'undefined') SeminariaAnalysis.load();
                break;
            case 'fortalezas':
                if (typeof SeminariaAnalysis !== 'undefined') SeminariaAnalysis.loadStrengths();
                break;
            case 'sugerencias':
                if (typeof SeminariaSuggestions !== 'undefined') SeminariaSuggestions.load();
                break;
            case 'trabajos':
                if (typeof SeminariaUploads !== 'undefined') SeminariaUploads.load();
                break;
            case 'config':
                if (typeof SeminariaConfig !== 'undefined') SeminariaConfig.load();
                break;
        }
    }

    // Bind nav clicks
    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            navigateTo(this.dataset.section);
        });
    });

    // ═══════════════ MOBILE MENU ═══════════════
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
            sidebarOverlay.classList.toggle('active');
        });
    }
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
            sidebarOverlay.classList.remove('active');
        });
    }

    // ═══════════════ COLOR PICKER ═══════════════
    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(option => {
        option.addEventListener('click', () => {
            colorOptions.forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            const color = option.dataset.color;
            document.documentElement.style.setProperty('--primary', color);
            document.documentElement.style.setProperty('--primary-dim', color + '26');
            document.documentElement.style.setProperty('--primary-glow', color + '66');
            SeminariaToast.show('Color actualizado', 'fa-palette');

            // Save to API if admin
            const user = SeminariaAuth.getUser();
            if (user && user.role === 'admin') {
                SeminariaAPI.put('/config', { primary_color: color }).catch(() => {});
            }
        });
    });

    // ═══════════════ RESET NAV ═══════════════
    function resetNav() {
        navLinks.forEach(l => l.classList.remove('active'));
        const dashNav = document.getElementById('nav-dashboard');
        if (dashNav) dashNav.classList.add('active');

        sections.forEach(s => s.classList.remove('active'));
        const dashSection = document.getElementById('section-dashboard');
        if (dashSection) dashSection.classList.add('active');
    }

    // ═══════════════ INITIALIZATION ═══════════════
    async function init() {
        // Try to restore session from saved token
        const restored = await SeminariaAuth.tryRestore();

        if (!restored) {
            // Show login screen — canvas is already running from animations.js
            console.log('🔐 SeminarIA — Awaiting login');
        } else {
            console.log('🚀 SeminarIA — Session restored');
        }
    }

    // Run init when DOM is ready (scripts are at end of body, so DOM is ready)
    init();

    return { navigateTo, resetNav };
})();
