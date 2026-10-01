/* ============================================
   Gold Mitra — Records list (search + gallery-style period filter)
   ============================================ */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const searchInput = $('#recordSearch');
  const clearBtn = $('#searchClear');
  const countEl = $('#recordsCount');
  const searchHint = $('#searchHint');
  const cardsEl = $('#recordsCards');
  const tableEl = $('#recordsTable');
  const emptyEl = $('#recordsEmpty');
  const errorEl = $('#recordsError');

  /* --- Filter elements --- */
  const monthNav = $('#monthNav');
  const monthLabel = $('#monthLabel');
  const monthPrev = $('#monthPrev');
  const monthNext = $('#monthNext');

  let debounceTimer;
  let currentSearch = '';
  let allApps = [];

  /* --- Active filter state --- */
  let activeFilter = 'all';   // 'all' | 'day' | 'week' | 'month'
  let navYear = new Date().getFullYear();
  let navMonth = new Date().getMonth(); // 0-indexed

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  /* ---------- Formatters ---------- */

  const fmtWeight = (w) =>
    Number(w || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' g';

  const fmtMoney = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  function showState(which) {
    cardsEl.innerHTML = '';
    tableEl.innerHTML = '';
    emptyEl.classList.add('hidden');
    errorEl.classList.add('hidden');
    if (which === 'empty') emptyEl.classList.remove('hidden');
    if (which === 'error') errorEl.classList.remove('hidden');
  }

  /* ---------- Gallery Period Filter ---------- */

  function updateMonthLabel() {
    if (monthLabel) monthLabel.textContent = `${MONTH_NAMES[navMonth]} ${navYear}`;
  }

  function filterByPeriod(list) {
    if (activeFilter === 'all') return list;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return list.filter((a) => {
      const d = new Date(a.loan.date || a.createdAt);
      if (activeFilter === 'day') {
        return d >= todayStart;
      }
      if (activeFilter === 'week') {
        const dayOfWeek = now.getDay(); // 0=Sun
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - dayOfWeek);
        return d >= weekStart;
      }
      if (activeFilter === 'month') {
        return d.getFullYear() === navYear && d.getMonth() === navMonth;
      }
      return true;
    });
  }

  function setActivePill(filterValue) {
    $$('.filter-pill').forEach((pill) => {
      pill.classList.toggle('is-active', pill.dataset.filter === filterValue);
    });
  }

  function onFilterChange(filterValue) {
    activeFilter = filterValue;
    setActivePill(filterValue);

    /* Show/hide month navigator */
    if (monthNav) {
      if (filterValue === 'month') {
        monthNav.classList.remove('hidden');
        updateMonthLabel();
      } else {
        monthNav.classList.add('hidden');
      }
    }

    render(allApps);
  }

  /* ---------- Renderers ---------- */

  function cardHTML(a) {
    return `
      <a class="record-card" href="/records/${a._id}" style="text-decoration:none">
        <div class="record-card__head">
          <div>
            <div class="record-card__no">${GM.escapeHtml(a.applicationNo)}<small>${GM.escapeHtml(a.customer.name)}</small></div>
          </div>
        </div>
        <div class="record-card__grid">
          <div class="record-card__cell">
            <div class="cell-label">Mobile</div>
            <div class="cell-value">${a.customer.mobile || '—'}</div>
          </div>
          <div class="record-card__cell">
            <div class="cell-label">Amount</div>
            <div class="cell-value">${fmtMoney(a.loan.amount)}</div>
          </div>
          <div class="record-card__cell">
            <div class="cell-label">Weight</div>
            <div class="cell-value">${fmtWeight(a.totalWeightGrams)}</div>
          </div>
        </div>
        <div class="record-card__date">🗓 &nbsp;${fmtDate(a.loan.date)}</div>
      </a>`;
  }

  function tableHTML(list) {
    return `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Application No</th>
              <th>Customer</th>
              <th>Mobile</th>
              <th>Amount</th>
              <th>Weight</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${list.map(rowHTML).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function rowHTML(a) {
    return `
      <tr data-href="/records/${a._id}" role="button" tabindex="0" onkeydown="if(event.key==='Enter'){window.location=this.dataset.href}">
        <td class="table__appno">${GM.escapeHtml(a.applicationNo)}</td>
        <td class="table__name">${GM.escapeHtml(a.customer.name)}</td>
        <td>${a.customer.mobile || '—'}</td>
        <td class="table__cell-strong">${fmtMoney(a.loan.amount)}</td>
        <td>${fmtWeight(a.totalWeightGrams)}</td>
        <td class="table__cell-muted">${fmtDate(a.loan.date)}</td>
        <td class="table__chevron">→</td>
      </tr>`;
  }

  function render(list) {
    /* Apply period filter */
    const filtered = filterByPeriod(list);

    if (!filtered.length) {
      showState('empty');
      if (currentSearch) {
        $('#emptyTitle').textContent = 'No matching records';
        $('#emptyText').textContent = `Nothing matches "${currentSearch}". Try a different search.`;
      } else if (activeFilter === 'day') {
        $('#emptyTitle').textContent = 'No records today';
        $('#emptyText').textContent = 'No applications recorded today.';
      } else if (activeFilter === 'week') {
        $('#emptyTitle').textContent = 'No records this week';
        $('#emptyText').textContent = 'No applications recorded this week.';
      } else if (activeFilter === 'month') {
        $('#emptyTitle').textContent = 'No records found';
        $('#emptyText').textContent = `No applications in ${MONTH_NAMES[navMonth]} ${navYear}.`;
      } else {
        $('#emptyTitle').textContent = 'No records yet';
        $('#emptyText').textContent = 'Applications you record in the field will appear here. Tap "New Application" to begin.';
      }
      setCount(filtered, !!currentSearch);
      return;
    }

    showState('list');
    setCount(filtered, !!currentSearch);
    cardsEl.innerHTML = filtered.map(cardHTML).join('');
    tableEl.innerHTML = tableHTML(filtered);
    /* make table rows clickable */
    tableEl.querySelectorAll('tr[data-href]').forEach((tr) => {
      tr.addEventListener('click', () => (location.href = tr.dataset.href));
    });
  }

  function setCount(list, fromSearch) {
    const n = list.length;
    if (fromSearch) {
      countEl.innerHTML = `<strong>${n}</strong> ${n === 1 ? 'record' : 'records'} found`;
    } else {
      countEl.innerHTML = n === 1 ? `<strong>1</strong> record` : `<strong>${n}</strong> records`;
    }
  }

  /* ---------- Load ---------- */

  async function load(search) {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    searchHint.style.display = search ? 'inline-flex' : 'none';
    clearBtn.classList.toggle('hidden', !search);

    try {
      const data = await GM.api(`/api/applications${query}`);
      searchHint.style.display = 'none';
      allApps = data.applications;
      render(allApps);
    } catch (err) {
      searchHint.style.display = 'none';
      showState('error');
      $('#errorText').textContent = err.message;
    }
  }

  /* ---------- Init ---------- */

  document.addEventListener('DOMContentLoaded', () => {
    load('');

    /* Search */
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const v = searchInput.value.trim();
      debounceTimer = setTimeout(() => {
        if (v === currentSearch) return;
        currentSearch = v;
        load(v);
      }, 300);
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      currentSearch = '';
      load('');
      searchInput.focus();
    });

    /* Filter pills */
    $$('.filter-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        onFilterChange(pill.dataset.filter);
      });
    });

    /* Month navigator arrows */
    if (monthPrev) {
      monthPrev.addEventListener('click', () => {
        navMonth--;
        if (navMonth < 0) { navMonth = 11; navYear--; }
        updateMonthLabel();
        render(allApps);
      });
    }
    if (monthNext) {
      monthNext.addEventListener('click', () => {
        navMonth++;
        if (navMonth > 11) { navMonth = 0; navYear++; }
        updateMonthLabel();
        render(allApps);
      });
    }

    $('#retryBtn').addEventListener('click', () => load(currentSearch));
  });
})();