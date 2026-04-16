/* ═══════════════════════════════════════════════════
   SeminarIA — Toast Notification System
   ═══════════════════════════════════════════════════ */

const SeminariaToast = (function () {
    'use strict';

    const container = document.getElementById('toast-container');

    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} icon - FontAwesome icon class (e.g., 'fa-check-circle')
     * @param {number} duration - Auto-dismiss time in ms (default 3200)
     */
    function show(message, icon = 'fa-info-circle', duration = 3200) {
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), duration);
    }

    /**
     * Show a success toast
     */
    function success(message) {
        show(message, 'fa-check-circle');
    }

    /**
     * Show a warning toast
     */
    function warning(message) {
        show(message, 'fa-exclamation-triangle');
    }

    /**
     * Show an error toast
     */
    function error(message) {
        show(message, 'fa-times-circle');
    }

    return { show, success, warning, error };
})();
