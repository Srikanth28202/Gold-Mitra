/* ============================================
   Gold Mitra — Responsive navigation
   Sidebar (desktop), scrim, mobile bottom nav,
   active-link routing, topbar brand on mobile
   ============================================ */
(function () {
  'use strict';

  function init() {
    const hamburger = document.querySelector('.topbar__hamburger');
    const sidebar = document.querySelector('.sidebar');
    const scrim = document.querySelector('.sidebar__scrim');

    const closeSidebar = () => {
      sidebar && sidebar.classList.remove('is-open');
      scrim && scrim.classList.remove('is-visible');
    };
    const openSidebar = () => {
      sidebar && sidebar.classList.add('is-open');
      scrim && scrim.classList.add('is-visible');
    };

    if (hamburger) hamburger.addEventListener('click', openSidebar);
    if (scrim) scrim.addEventListener('click', closeSidebar);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSidebar();
    });

    /* Highlight current navigation item based on path */
    const path = location.pathname.replace(/\/+$/, '') || '/';
    document.querySelectorAll('[data-nav-link]').forEach((link) => {
      const href = (link.getAttribute('href') || '').replace(/\/+$/, '') || '/';
      const isActive =
        path === href || (href !== '/' && path.startsWith(href));
      if (isActive) link.classList.add('is-active');
    });

    /* Close mobile nav / sidebar when a link is tapped */
    document.querySelectorAll('.nav-item, .mobile-nav__link').forEach((link) => {
      link.addEventListener('click', () => {
        if (window.innerWidth < 768) closeSidebar();
      });
    });

    /* Hydrate sidebar user + gate admin-only items */
    GM.api('/api/auth/me')
      .then((data) => {
        const name = data.user && data.user.name;
        if (!name) return;

        document.querySelectorAll('[data-user-full]').forEach((el) => {
          el.textContent = name;
        });
        document.querySelectorAll('[data-user-role]').forEach((el) => {
          el.textContent = (data.user.role || '').replace('-', ' ');
        });
        document.querySelectorAll('[data-user-initials]').forEach((el) => {
          el.textContent = GM.initials(name);
        });

        const isAdmin = data.user.role === 'admin';
        document.querySelectorAll('[data-admin-only]').forEach((el) => {
          el.classList.toggle('hidden', !isAdmin);
        });
      })
      .catch(() => {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();