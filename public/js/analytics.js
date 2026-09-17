/* Gold Mitra - analytics page client
   Consumes GET /api/analytics/summary?days=N
   Contract (byte-checked in src/routes/analytics.js):
   { scope, days,
     overall: { applications, amount, todayApplications, todayAmount, byStatus },
     byStatusAmounts,
     team: [ { _id, name, email, role, isActive, applications, amount, byStatus } ] } */

const STATUS_ICONS = { pending: 'P', approved: 'A', rejected: 'R', disbursed: 'D' };
const STATUS_CLASSES = { pending: 'pending', approved: 'approved', rejected: 'rejected', disbursed: 'disbursed' };
const STATUS_ORDER = ['pending', 'approved', 'rejected', 'disbursed'];
const STATUS_LABEL = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', disbursed: 'Disbursed' };

function zeroStatus() {
  return { pending: 0, approved: 0, rejected: 0, disbursed: 0 };
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('anaRefresh');
  const daysSel = document.getElementById('anaDays');
  const teamBody = document.getElementById('anaTeamBody');
  const scopeBadge = document.getElementById('anaScope');
  const totalApps = document.getElementById('anaTotalApps');
  const totalAmt = document.getElementById('anaTotalAmt');
  const todayApps = document.getElementById('anaTodayApps');
  const todayAmt = document.getElementById('anaTodayAmt');

  async function load() {
    GM.setLoading(btn, true, 'Loading...');
    try {
      const data = await GM.api('/api/analytics/summary?days=' + daysSel.value);
      scopeBadge.textContent = data.scope === 'all' ? 'All team' : 'My work';
      totalApps.textContent = String(data.overall.applications);
      totalAmt.textContent = GM.formatINR(data.overall.amount);
      todayApps.textContent = String(data.overall.todayApplications);
      todayAmt.textContent = GM.formatINR(data.overall.todayAmount說);
      renderStatus(data.overall.byStatus, data.byStatusAmounts);
      renderTeam(data.team || []);
    } catch (err) {
      GM.toast(err.message || 'Could not load analytics.', 'red');
    } finally {
      GM.setLoading(btn, false, 'Refresh');
    }
  }

  function renderStatus(byStatus, amounts) {
    const grid = document.getElementById('anaStatusGrid');
    if (!grid) return;
    const counts = byStatus || {};
    const amts = amounts || {};
    grid.innerHTML = STATUS_ORDER.map((key) => {
      const c = counts[key] || 0;
      const a = amts[key] || 0;
      return (
        '<div class="stat-card">' +
          '<div class="stat-card__label">' + STATUS_LABEL[key] + '</div>' +
          '<div class="stat-card__value">' + c + '</div>' +
          '<div class="stat-card__hint">' + GM.formatINR(a) + '</div>' +
        '</div>'
      );
    }).join('');
  }

  function renderTeam(team) {
    const grid = document.getElementById('anaTeamGrid');
    if (!grid) { renderTeamTable(team); return; }
    grid.innerHTML = team.map((m) => {
      const st = m.byStatus || {};
      const chips = STATUS_ORDER.map((k) =>
        '<span class="chip chip--' + STATUS_CLASSES[k] + '">' + STATUS_ICONS[k] + ' ' + (st[k] || 0) + '</span>').join('');
      return (
        '<div class="team-card">' +
          '<div class="team-card__head">' +
            '<span class="avatar" data-user-initials>' + GM.initials(m.name) + '</span>' +
            '<div>' +
              '<div class="team-card__name">' + GM.escapeHtml(m.name) + '</div>' +
              '<div class="team-card__meta">' + (m.role === 'admin' ? 'Admin' : 'Field Officer') + '</div>' +
            '</div>' +
            '<div class="team-card__count">' + m.applications + '</div>' +
          '</div>' +
          '<div class="team-card__amount">' + GM.formatINR(m.amount) + '</div>' +
          '<div class="team-card__chips">' + chips + '</div>' +
        '</div>'
      );
    }).join('');
  }

  function renderTeamTable(team) {
    const tbody = document.getElementById('anaTeamBody');
    if (!tbody) return;
    tbody.innerHTML = team.map((m) => {
      const st = m.byStatus || {};
      const cells = STATUS_ORDER.map((k) =>
        '<td class="num">' + (st[k] || 0) + '</td>').join('');
      return (
        '<tr>' +
          '<td>' + GM.escapeHtml(m.name) + '</td>' +
          '<td class="num">' + m.applications + '</td>' +
          '<td class="num">' + GM.formatINR(m.amount) + '</td>' +
          cells +
        '</tr>'
      );
    }).join('');
  }

  btn.addEventListener('click', load);
  daysSel.addEventListener('change', load);
  load();
});