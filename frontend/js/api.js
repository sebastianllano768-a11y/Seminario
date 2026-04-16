/* ═══════════════════════════════════════════════════
   SeminarIA — API Communication Layer
   Wrapper around fetch() with JWT auto-injection
   ═══════════════════════════════════════════════════ */

const SeminariaAPI = (function () {
    'use strict';

    const BASE_URL = window.location.hostname === 'localhost' || window.location.protocol === 'file:'
        ? 'http://localhost:3000/api'
        : '/api';

    /**
     * Get the stored JWT token
     */
    function getToken() {
        return localStorage.getItem('seminaria_token');
    }

    /**
     * Set the JWT token
     */
    function setToken(token) {
        localStorage.setItem('seminaria_token', token);
    }

    /**
     * Remove the JWT token
     */
    function removeToken() {
        localStorage.removeItem('seminaria_token');
    }

    /**
     * Check if a token exists
     */
    function hasToken() {
        return !!getToken();
    }

    /**
     * Core fetch wrapper with auth header injection
     * @param {string} endpoint - API endpoint (e.g., '/auth/login')
     * @param {Object} options - fetch options
     * @returns {Promise<Object>} JSON response
     */
    async function request(endpoint, options = {}) {
        const url = `${BASE_URL}${endpoint}`;

        const headers = {
            ...(options.headers || {})
        };

        // Add auth header if token exists
        const token = getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Add content-type for JSON bodies (not for FormData/file uploads)
        if (options.body && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
            if (typeof options.body === 'object') {
                options.body = JSON.stringify(options.body);
            }
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            const data = await response.json();

            if (!response.ok) {
                // Handle expired token
                if (response.status === 401) {
                    removeToken();
                    localStorage.removeItem('seminaria_user');
                    // Trigger re-login if we're in the app
                    if (typeof SeminariaAuth !== 'undefined' && SeminariaAuth.handleExpiredToken) {
                        SeminariaAuth.handleExpiredToken();
                    }
                }
                throw { status: response.status, ...data };
            }

            return data;

        } catch (err) {
            if (err.status) throw err; // Re-throw API errors
            // Network error
            throw { status: 0, error: 'Error de conexión. Verifica tu conexión a internet.' };
        }
    }

    /**
     * Convenience methods
     */
    function get(endpoint) {
        return request(endpoint, { method: 'GET' });
    }

    function post(endpoint, body) {
        return request(endpoint, { method: 'POST', body });
    }

    function put(endpoint, body) {
        return request(endpoint, { method: 'PUT', body });
    }

    function del(endpoint) {
        return request(endpoint, { method: 'DELETE' });
    }

    /**
     * Upload a file via FormData
     */
    function uploadFile(endpoint, file, fieldName = 'file') {
        const formData = new FormData();
        formData.append(fieldName, file);
        return request(endpoint, { method: 'POST', body: formData });
    }

    return {
        getToken, setToken, removeToken, hasToken,
        getBaseUrl: () => BASE_URL,
        request, get, post, put, del, uploadFile
    };
})();
