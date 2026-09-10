/* ============================================
   Gold Mitra — Records list (search + responsive render)
   ============================================ */
(function () {
  'use strict';

  const STATUS = {
    pending: { label: 'Pending', cls: 'badge--amber' },
    approved: { label: 'Approved', cls: 'badge--blue' },
    rejected: { label: 'Rejected', cls: 'badge--red' },
    disbursed: { label: 'Disbursed', cls: 'badge--green' }
  };

  const $ = (s) => document.querySelector(s);
  const searchInput = $('#recordSearch');
  const clearBtn = $('#searchClear');
  const countEl = $('#recordsCount');
  const searchHint = $('#searchHint');
  const cardsEl = $('#recordsCards');
  const tableEl = $('#recordsTable');
  const emptyEl = $('#recordsEmpty');
  const errorEl = $('#recordsError');

  let debounceTimer;
  let currentSearch = '';

  const fmtWeight = (w) =>
    Number(w || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' g';

  const fmtMoney = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  function statusBadge(status) {
    const s = STATUS[status] || STATUS.pending;
    return `<span class="badge ${s.cls}"><span class="badge__dot"></span>${s.label}</span>`;
  }

  function showState(which) {
    cardsEl.innerHTML = '';
    tableEl.innerHTML = '';
    emptyEl.classList.add('hidden');
    errorEl.classList.add('hidden');
    if (which === 'empty') emptyEl.classList.remove('hidden');
    if (which === 'error') errorEl.classList.remove('hidden');
  }

  /* ---------- Renderers ---------- */

  function cardHTML(a) {
    return `
      <a class="record-card" href="/records/${a._id}" style="text-decoration:none">
        <div class="record-card__head">
          <div>
            <div class="record-card__no">${GM.escapeHtml(a.applicationNo)}<small>${GM.escapeHtml(a.customer.name)}</small></div>
          </div>
          ${statusBadge(a.status)}
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
          <div class="record-card__cell">
            <div class="cell-label">Status</div>
            <div class="cell-value">${(STATUS[a.status] || STATUS.pending).label}</div>
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
              <th>Status</th>
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
        <td>${statusBadge(a.status)}</td>
        <td class="table__chevron">→</td>
      </tr>`;
  }

  function render(list) {
    if (!list.length) {
      showState('empty');
      if (currentSearch) {
        $('#emptyTitle').textContent = 'No matching records';
        $('#emptyText').textContent = `Nothing matches “${currentSearch}”. Try a different search.`;
      } else {
        $('#emptyTitle').textContent = 'No records yet';
        $('#emptyText').textContent = 'Applications you record in the field will appear here. Tap “New Application” to begin.';
      }
      return;
    }

    showState('list');
    cardsEl.innerHTML = list.map(cardHTML).join('');
    tableEl.innerHTML = tableHTML(list);
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
      setCount(data.applications, !!search);
      render(data.applications);
    } catch (err) {
      searchHint.style.display = 'none';
      showState('error');
      $('#errorText').textContent = err.message;
    }
  }

  /* ---------- Init ---------- */

  document.addEventListener('DOMContentLoaded', () => {
    load('');

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

    $('#retryBtn').addEventListener('click', () => load(currentSearch));
  });
})();