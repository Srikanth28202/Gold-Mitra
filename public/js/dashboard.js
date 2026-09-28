/* ============================================
   Gold Mitra — Dashboard client
   Consumes GET /api/dashboard/stats

   Response shape (see src/routes/dashboard.js):
   {
     scope: 'all' | 'own',
     applications: { day, month, year },   // counts
     amount:       { day, week },          // rupees transferred
     goldGrams:    { day, week },          // grams pledged
     recent: [{ id, applicationNo, customerName,
                weightGrams, amount, createdAt }]
   }
   ============================================ */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);

  const appsGrid = $('#appsGrid');
  const flowGrid = $('#flowGrid');
  const recentBody = $('#recentBody');
  const recentEmpty = $('#recentEmpty');
  const errorCard = $('#statsError');
  const errorText = $('#statsErrorText');
  const scopeBadge = $('#scopeBadge');
  const periodLine = $('#dashPeriod');
  const greeting = $('#dashGreeting');
  const refreshBtn = $('#refreshBtn');

  const money = (n) =>
    '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

  const grams = (n) =>
    (Math.round((Number(n) || 0) * 1000) / 1000).toLocaleString('en-IN', {
      maximumFractionDigits: 3
    });

  const tile = (label, value, unit, sub, variant) => `
    <div class="stat${variant ? ' stat--' + variant : ''}">
      <span class="stat__label">${label}</span>
      <div class="stat__value">${value}${unit ? `<span class="stat__unit">${unit}</span>` : ''}</div>
      <span class="stat__sub">${sub}</span>
    </div>`;

  const skeletons = (n) => Array.from({ length: n }, () => '<div class="skeleton skeleton--card"></div>').join('');

  function greetingFor() {
    const h = Number(new Date().getHours());
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function when(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  }

  function render(data) {
    errorCard.classList.add('hidden');

    scopeBadge.textContent = data.scope === 'all' ? 'All applications' : 'My applications';

    greeting.textContent = greetingFor() + ', here are your figures';
    periodLine.textContent =
      'Day, week, month and year totals to date · all times IST';

    /* Applications: day / month / year */
    appsGrid.innerHTML = [
      tile('Today', data.applications.day, '', 'Applications registered today', 'neutral'),
      tile('This month', data.applications.month, '', 'Registered so far this month', 'neutral'),
      tile('This year', data.applications.year, '', 'Registered so far this year', 'neutral')
    ].join('');

    /* Amount transferred + gold: day / week */
    flowGrid.innerHTML = [
      tile('Transferred today', money(data.amount.day), '', 'Amount transferred today', 'money'),
      tile('Transferred this week', money(data.amount.week), '', 'Monday to date', 'money'),
      tile('Gold today', grams(data.goldGrams.day), 'g', 'Gold received today', 'gold'),
      tile('Gold this week', grams(data.goldGrams.week), 'g', 'Monday to date', 'gold')
    ].join('');

    /* Recent applications */
    if (!data.recent.length) {
      recentBody.innerHTML = '';
      recentEmpty.classList.remove('hidden');
      return;
    }

    recentEmpty.classList.add('hidden');
    recentBody.innerHTML = data.recent
      .map(
        (a) => `
        <tr>
          <td><span class="badge badge--gold">${GM.escapeHtml(a.applicationNo)}</span></td>
          <td>${GM.escapeHtml(a.customerName)}</td>
          <td class="ta-right">${money(a.amount)}</td>
          <td class="ta-right">${grams(a.weightGrams)} g</td>
          <td>${when(a.createdAt)}</td>
        </tr>`
      )
      .join('');
  }

  function showSkeletons() {
    appsGrid.innerHTML = skeletons(3);
    flowGrid.innerHTML = skeletons(4);
  }

  async function load() {
    showSkeletons();
    try {
      const data = await GM.api('/api/dashboard/stats');
      render(data);
    } catch (err) {
      appsGrid.innerHTML = '';
      flowGrid.innerHTML = '';
      recentBody.innerHTML = '';
      recentEmpty.classList.add('hidden');
      errorText.textContent = err && err.message ? err.message : 'Please try again.';
      errorCard.classList.remove('hidden');
    }
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', load);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
