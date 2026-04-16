/* ═══════════════════════════════════════════════════
   SeminarIA — Authentication Module
   Login, Logout, Registration, Session management
   ═══════════════════════════════════════════════════ */

const SeminariaAuth = (function () {
    'use strict';

    // ─── DOM References ───
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app-screen');
    const loginContainer = document.getElementById('login-container');
    const signUpBtn = document.getElementById('signUp');
    const signInBtn = document.getElementById('signIn');
    const signInForm = document.getElementById('signin-form');
    const signUpForm = document.getElementById('signup-form');

    let currentUser = null;

    // ═══════════════ TOGGLE SIGN-IN / SIGN-UP ═══════════════
    if (signUpBtn) {
        signUpBtn.addEventListener('click', () => {
            loginContainer.classList.add('right-panel-active');
        });
    }
    if (signInBtn) {
        signInBtn.addEventListener('click', () => {
            loginContainer.classList.remove('right-panel-active');
        });
    }

    // ═══════════════ SIGN IN ═══════════════
    if (signInForm) {
        signInForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('signin-email').value.trim();
            const password = document.getElementById('signin-password').value;

            if (!email || !password) {
                SeminariaToast.warning('Por favor completa todos los campos');
                return;
            }

            const btn = document.getElementById('btn-signin');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ingresando...';

            try {
                const data = await SeminariaAPI.post('/auth/login', { email, password });
                SeminariaAPI.setToken(data.token);
                loginSuccess(data.user);
            } catch (err) {
                SeminariaToast.error(err.error || 'Error al iniciar sesión');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Ingresar';
            }
        });
    }

    // ═══════════════ SIGN UP ═══════════════
    if (signUpForm) {
        signUpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('signup-name').value.trim();
            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-password').value;

            if (!name || !email || !password) {
                SeminariaToast.warning('Por favor completa todos los campos');
                return;
            }

            if (password.length < 6) {
                SeminariaToast.warning('La contraseña debe tener al menos 6 caracteres');
                return;
            }

            const btn = document.getElementById('btn-signup');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';

            try {
                const data = await SeminariaAPI.post('/auth/register', { name, email, password });
                SeminariaAPI.setToken(data.token);
                loginSuccess(data.user);
            } catch (err) {
                SeminariaToast.error(err.error || 'Error al registrarse');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-user-plus"></i> Registrarse';
            }
        });
    }

    // ═══════════════ GOOGLE OAUTH (Authorization Code Flow) ═══════════════
    let googleClientId = null;

    async function initGoogle() {
        try {
            const data = await SeminariaAPI.request('/config/google-client-id', { method: 'GET' });
            if (!data.client_id || data.client_id.includes('tu-client-id')) return;
            googleClientId = data.client_id;
            console.log('✅ Google Sign-In ready');
        } catch (err) {
            console.log('ℹ️ Google Sign-In not available');
        }
    }

    function triggerGoogleSignIn() {
        if (!googleClientId) {
            SeminariaToast.warning('Google Sign-In no está configurado.');
            return;
        }

        const redirectUri = window.location.origin + '/api/auth/google/callback';
        const url = 'https://accounts.google.com/o/oauth2/v2/auth?' +
            'client_id=' + encodeURIComponent(googleClientId) +
            '&redirect_uri=' + encodeURIComponent(redirectUri) +
            '&response_type=code' +
            '&scope=openid%20email%20profile' +
            '&prompt=select_account';

        // Redirect to Google (callback will save token and redirect back)
        window.location.href = url;
    }

    // Google button handlers
    const googleSigninBtn = document.getElementById('btn-google-signin');
    if (googleSigninBtn) googleSigninBtn.addEventListener('click', triggerGoogleSignIn);

    const googleSignupBtn = document.getElementById('btn-google-signup');
    if (googleSignupBtn) googleSignupBtn.addEventListener('click', triggerGoogleSignIn);

    // Initialize on load
    window.addEventListener('load', initGoogle);

    // ═══════════════ LOGIN SUCCESS ═══════════════
    function loginSuccess(user) {
        currentUser = user;
        localStorage.setItem('seminaria_user', JSON.stringify(user));

        // Stop canvas animation
        if (typeof SeminariaAnimations !== 'undefined') {
            SeminariaAnimations.stopCanvas();
        }

        // Transition to app
        loginScreen.classList.add('hidden');
        setTimeout(() => {
            loginScreen.style.display = 'none';
            appScreen.style.display = 'flex';
            applyRole(user.role);
            updateWelcome(user);

            // Load saved config (color, etc.)
            if (user.role === 'admin' && typeof SeminariaConfig !== 'undefined') {
                SeminariaConfig.load();
            }

            // Load dashboard data
            if (typeof SeminariaDashboard !== 'undefined') {
                SeminariaDashboard.load();
            }

            // Load sessions for evaluation dropdown
            if (typeof SeminariaEvaluations !== 'undefined') {
                SeminariaEvaluations.loadSessions();
            }

            // Trigger animations
            setTimeout(() => {
                if (typeof SeminariaAnimations !== 'undefined') {
                    SeminariaAnimations.animateDashboard();
                }
            }, 300);
        }, 500);

        SeminariaToast.success(`¡Bienvenido, ${user.name}!`);
    }

    // ═══════════════ APPLY ROLE ═══════════════
    function applyRole(role) {
        document.body.classList.remove('role-admin', 'role-student');
        document.body.classList.add(role === 'admin' ? 'role-admin' : 'role-student');
    }

    // ═══════════════ UPDATE WELCOME BAR ═══════════════
    function updateWelcome(user) {
        const greeting = document.getElementById('welcome-greeting');
        const roleEl = document.getElementById('welcome-role');
        if (greeting) greeting.textContent = `Bienvenido, ${user.name}`;
        if (roleEl) {
            roleEl.textContent = user.role === 'admin' ? 'Administrador' : 'Estudiante';
            if (user.role !== 'admin') {
                roleEl.style.background = 'rgba(0, 201, 255, 0.15)';
                roleEl.style.color = '#00c9ff';
            } else {
                roleEl.style.background = '';
                roleEl.style.color = '';
            }
        }
    }

    // ═══════════════ LOGOUT ═══════════════
    function logout() {
        currentUser = null;
        SeminariaAPI.removeToken();
        localStorage.removeItem('seminaria_user');
        document.body.classList.remove('role-admin', 'role-student');

        appScreen.style.display = 'none';
        loginScreen.style.display = '';
        loginScreen.classList.remove('hidden');

        // Restart canvas animation
        if (typeof SeminariaAnimations !== 'undefined') {
            SeminariaAnimations.restartCanvas();
        }

        // Reset nav to dashboard
        if (typeof SeminariaApp !== 'undefined') {
            SeminariaApp.resetNav();
        }

        // Reset forms
        if (signInForm) signInForm.reset();
        if (signUpForm) signUpForm.reset();
    }

    // Bind logout buttons
    const logoutNav = document.getElementById('nav-logout');
    if (logoutNav) logoutNav.addEventListener('click', (e) => { e.preventDefault(); logout(); });

    const logoutDesktop = document.getElementById('btn-logout-desktop');
    if (logoutDesktop) logoutDesktop.addEventListener('click', logout);

    // ═══════════════ HANDLE EXPIRED TOKEN ═══════════════
    function handleExpiredToken() {
        SeminariaToast.warning('Tu sesión ha expirado, inicia sesión de nuevo');
        logout();
    }

    // ═══════════════ AUTO-LOGIN (restore session) ═══════════════
    async function tryRestore() {
        if (!SeminariaAPI.hasToken()) return false;

        try {
            const data = await SeminariaAPI.get('/auth/me');
            currentUser = data.user;
            localStorage.setItem('seminaria_user', JSON.stringify(data.user));

            loginScreen.style.display = 'none';
            appScreen.style.display = 'flex';
            applyRole(data.user.role);
            updateWelcome(data.user);

            // Load saved config (color, etc.)
            if (data.user.role === 'admin' && typeof SeminariaConfig !== 'undefined') {
                SeminariaConfig.load();
            }

            // Load data
            if (typeof SeminariaDashboard !== 'undefined') {
                SeminariaDashboard.load();
            }
            if (typeof SeminariaEvaluations !== 'undefined') {
                SeminariaEvaluations.loadSessions();
            }

            setTimeout(() => {
                if (typeof SeminariaAnimations !== 'undefined') {
                    SeminariaAnimations.animateDashboard();
                }
            }, 300);

            return true;
        } catch (err) {
            // Token invalid — clear it
            SeminariaAPI.removeToken();
            localStorage.removeItem('seminaria_user');
            return false;
        }
    }

    // ═══════════════ PUBLIC API ═══════════════
    return {
        getUser: () => currentUser,
        logout,
        handleExpiredToken,
        tryRestore,
        loginSuccess
    };
})();
