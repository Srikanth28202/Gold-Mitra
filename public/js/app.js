/* ============================================
   Gold Mitra — Dashboard logic
   Stats, chart, recent loans & team today come
   from /api/dashboard/stats (no demo data).
   ============================================ */
(function () {
  'use strict';

  const STATUS_BADGE = {
    pending: { cls: 'badge--amber', label: 'Pending' },
    approved: { cls: 'badge--blue', label: 'Approved' },
    rejected: { cls: 'badge--red', label: 'Rejected' },
    disbursed: { cls: 'badge--green', label: 'Disbursed' }
  };

  function init() {
    hydrateUser();
    loadStats();
  }

  function hydrateUser() {
    GM.api('/api/auth/me')
      .then((data) => {
        const name = data.user && data.user.name;
        if (!name) return;

        const firstName = name.split(' ')[0];

        document.querySelectorAll('[data-user-name]').forEach((el) => {
          el.textContent = firstName;
        });
        document.querySelectorAll('[data-user-full]').forEach((el) => {
          el.textContent = name;
        });
        document.querySelectorAll('[data-user-role]').forEach((el) => {
          el.textContent = data.user.role.replace('-', ' ');
        });
        document.querySelectorAll('[data-user-initials]').forEach((el) => {
          el.textContent = GM.initials(name);
        });

        const greet = document.getElementById('dashGreeting');
        if (greet) {
          const h = new Date().getHours();
          const period = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
          greet.textContent = `${period}, ${firstName}`;
        }

        const periodBadge = document.getElementById('periodBadge');
        if (periodBadge) {
          const d = new Date();
          periodBadge.textContent = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        }
      })
      .catch(() => {});
  }

  async function loadStats() {
    const grid = document.getElementById('statsGrid');
    const skeleton = document.getElementById('statsSkeleton');
    const empty = document.getElementById('statsEmpty');

    try {
      const data = await GM.api('/api/dashboard/stats');
      const s = data.stats;

      if (skeleton) skeleton.classList.add('hidden');
      if (empty) empty.classList.add('hidden');
      if (grid) {
        grid.innerHTML = `
          <div class="stat animate-in">
            <div class="stat__icon">◆</div>
            <div class="stat__label">Active Applications</div>
            <div class="stat__value">${s.totalApplications}</div>
            <div class="stat__sub mt-2">across your ${data.scope === 'own' ? 'records' : 'portfolio'}</div>
          </div>
          <div class="stat animate-in animate-in-delay-1">
            <div class="stat__icon stat__icon--green">₹</div>
            <div class="stat__label">Disbursed Today</div>
            <div class="stat__value">${GM.formatINR(s.todayDisbursed)}</div>
            <div class="stat__sub mt-2">${s.todayApplications} application${s.todayApplications === 1 ? '' : 's'} today</div>
          </div>
          <div class="stat animate-in animate-in-delay-2">
            <div class="stat__icon stat__icon--amber">Σ</div>
            <div class="stat__label">Total Disbursed</div>
            <div class="stat__value">${GM.formatINR(s.portfolio)}</div>
            <div class="stat__sub mt-2">principal across all loans</div>
          </div>
          <div class="stat animate-in animate-in-delay-3">
            <div class="stat__icon stat__icon--blue">◈</div>
            <div class="stat__label">Team Today</div>
            <div class="stat__value">${(data.teamToday || []).length}</div>
            <div class="stat__sub mt-2">${(data.teamToday || []).filter((m) => m.applicationsToday > 0).length} on field</div>
          </div>
        `;
      }

      renderChart(data.chart || { labels: [], values: [] });
      renderRecent(data.recent || []);
      renderTeam(data.teamToday || []);
      renderActivity(data.recent || []);
    } catch (err) {
      if (skeleton) skeleton.classList.add('hidden');
      if (empty) empty.classList.remove('hidden');
      if (empty) empty.querySelector('.empty-state__text').textContent = err.message;
    }
  }

  function renderChart(chart) {
    const wrap = document.getElementById('weeklyChart');
    if (!wrap) return;

    const labels = chart.labels.length ? chart.labels : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
    const values = chart.values && chart.values.length ? chart.values : labels.map(() => 0);
    const max = Math.max(...values, 1);

    const bars = values
      .map((v, i) => {
        const h = Math.max(4, Math.round((v / max) * 100));
        return `<div class="mini-chart__bar" data-height="${h}" title="${labels[i]} · ${GM.formatINR(v)}"></div>`;
      })
      .join('');

    wrap.innerHTML = `
      <div class="mini-chart">
        ${bars}
      </div>
      <div class="mini-chart__labels">
        ${labels.map((d) => `<span>${d}</span>`).join('')}
      </div>
    `;

    wrap.querySelectorAll('.mini-chart__bar').forEach((bar) => {
      requestAnimationFrame(() => {
        bar.style.height = bar.dataset.height + '%';
        bar.style.transition = 'height 700ms cubic-bezier(0.22, 1, 0.36, 1)';
      });
    });
  }

  function renderRecent(recent) {
    const tbody = document.getElementById('recentTable');
    if (!tbody) return;

    if (!recent.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="table__cell-muted" style="text-align:center; padding:28px">
            No applications yet — record your first loan from the New Application screen.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = recent
      .map((a) => {
        const badge = STATUS_BADGE[a.status] || { cls: 'badge--neutral', label: a.status };
        return `
          <tr>
            <td class="table__loan-id">${GM.escapeHtml(a.applicationNo)}<small>${Number(a.weightGrams || 0).toFixed(2)} g</small></td>
            <td class="table__cell-strong">${GM.escapeHtml(a.customerName || '—')}</td>
            <td class="table__cell-strong">${GM.formatINR(a.amount)}</td>
            <td><span class="badge ${badge.cls}">${badge.label}</span></td>
            <td class="table__cell-muted">${GM.formatDate(a.createdAt)}</td>
          </tr>`;
      })
      .join('');
  }

  function renderTeam(team) {
    const list = document.getElementById('teamList');
    if (!list) return;

    if (!team.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">◈</div>
          <div class="empty-state__text">No team members yet — add them from Settings.</div>
        </div>`;
      return;
    }

    list.innerHTML = team
      .map((m) => {
        const initials = GM.initials(m.name);
        const title = m.applicationsToday
          ? `${m.applicationsToday} application${m.applicationsToday === 1 ? '' : 's'} today`
          : 'No applications today';
        return `
          <div class="list-row">
            <div class="avatar">${initials}</div>
            <div class="list-row__meta">
              <div class="list-row__title">${GM.escapeHtml(m.name)}</div>
              <div class="list-row__sub">${title}</div>
            </div>
            <div class="list-row__end"><span class="badge ${m.applicationsToday ? 'badge--green' : m.isActive ? 'badge--neutral' : 'badge--red'}">${m.applicationsToday ? 'On field' : m.isActive ? 'Active' : 'Inactive'}</span></div>
          </div>`;
      })
      .join('');
  }

  function renderActivity(recent) {
    const feed = document.getElementById('activityFeed');
    if (!feed) return;

    if (!recent.length) {
      feed.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">◠</div>
          <div class="empty-state__text">No activity yet — new applications will appear here.</div>
        </div>`;
      return;
    }

    feed.innerHTML = recent
      .map(
        (a, i) => `
      <div class="activity__item animate-in animate-in-delay-${Math.min(i, 4)}">
        <div class="activity__dot">◆</div>
        <div class="activity__text">
          <strong>${GM.escapeHtml(a.customerName || '—')}</strong> — new application <strong>${GM.escapeHtml(a.applicationNo)}</strong> for ${GM.formatINR(a.amount)}
        </div>
        <div class="activity__time">${GM.formatDate(a.createdAt)}</div>
      </div>`
      )
      .join('');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();