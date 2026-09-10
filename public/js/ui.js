/* ============================================
   Gold Mitra — Reusable UI components
   Exposes window.GM namespace
   ============================================ */
(function () {
  'use strict';

  const GM = window.GM || {};

  /* ---------- Toast ---------- */

  let toastStack;

  function ensureToastStack() {
    if (!toastStack) {
      toastStack = document.createElement('div');
      toastStack.className = 'toast-stack';
      document.body.appendChild(toastStack);
    }
    return toastStack;
  }

  const _icons = {
    success: '✓',
    danger: '✕',
    gold: '◆',
    info: 'ℹ'
  };

  GM.toast = function (message, type = 'gold', duration = 3200) {
    const stack = ensureToastStack();
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `
      <span class="toast__icon">${_icons[type] || '◆'}</span>
      <span>${message}</span>
    `;
    stack.appendChild(el);

    const remove = () => {
      el.classList.add('is-leaving');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    };

    setTimeout(remove, duration);

    el.addEventListener('click', remove);
    return el;
  };

  /* ---------- Button loading state ---------- */

  GM.setLoading = function (btn, isLoading, label) {
    if (isLoading) {
      btn.dataset.original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span><span>${label || 'Please wait…'}</span>`;
    } else {
      btn.disabled = false;
      if (btn.dataset.original) {
        btn.innerHTML = btn.dataset.original;
        delete btn.dataset.original;
      }
    }
  };

  /* ---------- Simple fetch wrapper ---------- */

  GM.api = async function (url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  GM.escapeHtml = function (str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
  };

  /* ---------- Compress image to data URL (for field uploads) ---------- */

  GM.compressImage = function (file, maxDim = 900, quality = 0.68) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No file provided'));
      if (!file.type || !file.type.startsWith('image/')) {
        return reject(new Error('Please choose an image file'));
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read the file'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Could not read the image'));
        img.onload = () => {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  /* ---------- Date formatting ---------- */

  GM.formatDate = function (input) {
    const d = input ? new Date(input) : new Date();
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  GM.formatTime = function (input) {
    const d = input ? new Date(input) : new Date();
    return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  };

  GM.formatINR = function (n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN');
  };

  GM.initials = function (name) {
    return String(name || '?')
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  window.GM = GM;
})();