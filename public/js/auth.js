/* ============================================
   Gold Mitra — Auth / login page
   ============================================ */
(function () {
  'use strict';

  function init() {
    const form = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorBox = document.getElementById('loginError');
    const submitBtn = document.getElementById('loginBtn');
    const passToggle = document.getElementById('passToggle');

    /* Password visibility toggle */
    if (passToggle && passwordInput) {
      passToggle.addEventListener('click', () => {
        const isText = passwordInput.type === 'text';
        passwordInput.type = isText ? 'password' : 'text';
        passToggle.textContent = isText ? '👁' : '🙈';
      });
    }

    const clearError = () => {
      errorBox.classList.remove('is-visible');
      form
        .querySelectorAll('.field')
        .forEach((f) => f.classList.remove('field--invalid'));
    };

    const showError = (msg) => {
      errorBox.querySelector('.alert__msg').textContent = msg;
      errorBox.classList.add('is-visible');
    };

    /* Live validate on submit */
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearError();

        let isValid = true;
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email) {
          emailInput.closest('.field').classList.add('field--invalid');
          emailInput.closest('.field').querySelector('.field__error').textContent = 'Enter your email address';
          isValid = false;
        } else if (!/^\S+@\S+\.\S+$/.test(email)) {
          emailInput.closest('.field').classList.add('field--invalid');
          emailInput.closest('.field').querySelector('.field__error').textContent = 'Enter a valid email address';
          isValid = false;
        }

        if (!password) {
          passwordInput.closest('.field').classList.add('field--invalid');
          passwordInput.closest('.field').querySelector('.field__error').textContent = 'Enter your password';
          isValid = false;
        }

        if (!isValid) return;

        GM.setLoading(submitBtn, true, 'Signing in…');

        try {
          const data = await GM.api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
          });

          if (data.success) {
            GM.toast(`Welcome back, ${data.user.name.split(' ')[0]}!`, 'gold');
            setTimeout(() => (location.href = '/'), 350);
          } else {
            showError('Incorrect email or password.');
            GM.setLoading(submitBtn, false);
          }
        } catch (err) {
          showError(err.message);
          GM.setLoading(submitBtn, false);
        }
      });

      [emailInput, passwordInput].forEach((input) => {
        input.addEventListener('input', clearError);
      });
    }

    /* Check server/db status */
    GM.api('/api/health')
      .then((data) => {
        const badge = document.getElementById('dbStatus');
        if (!badge) return;
        if (data.db === 'connected') {
          badge.classList.add('is-live');
          badge.innerHTML = '<span class="badge__dot"></span>Database connected';
        } else {
          badge.classList.add('is-down');
          badge.innerHTML = '<span class="badge__dot"></span>Database offline';
        }
      })
      .catch(() => {});

    /* Pre-fill focus */
    if (emailInput && !emailInput.value) emailInput.focus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();