/* ============================================
   Gold Mitra — Record detail view + delete
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
  const root = $('#recordRoot');

  const recordId =
    (location.pathname.match(/^\/records\/([0-9a-fA-F]{24})$/) || [])[1] || null;

  const fmtWeight = (w) =>
    Number(w || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' g';

  const fmtMoney = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const fmtDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return (
      d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' · ' +
      d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    );
  };

  function statusBadge(status) {
    const s = STATUS[status] || STATUS.pending;
    return `<span class="badge ${s.cls}"><span class="badge__dot"></span>${s.label}</span>`;
  }

  function kv(label, value, cls = '') {
    return `
      <div class="kv__row">
        <span class="kv__label">${label}</span>
        <span class="kv__value ${cls}">${value}</span>
      </div>`;
  }

  function itemHTML(item, i) {
    const thumb = item.photoData
      ? `<img class="record-item__thumb" src="${item.photoData}" alt="${GM.escapeHtml(item.itemName)}" />`
      : `<div class="record-item__thumb" style="display:grid;place-items:center;color:var(--ink-300)">◆</div>`;
    const sub = item.description
      ? `${GM.escapeHtml(item.purity)} · ${GM.escapeHtml(item.description)}`
      : GM.escapeHtml(item.purity);
    return `
      <div class="record-item">
        ${thumb}
        <div class="record-item__meta">
          <div class="record-item__name">${GM.escapeHtml(item.itemName)}</div>
          <div class="record-item__sub">${sub}</div>
        </div>
        <div class="record-item__end">
          <div class="record-item__weight">${fmtWeight(item.weightGrams)}</div>
          <div class="record-item__sub">Item ${i + 1}</div>
        </div>
      </div>`;
  }

  function render(a) {
    const jsx = `
      <div class="page-head">
        <div>
          <a href="/records" class="text-muted" style="font-size:var(--fs-sm);font-weight:var(--fw-medium)">← Back to records</a>
        </div>
      </div>

      <div class="record-detail">

        <div class="detail-head animate-in">
          <div class="detail-head__titles">
            <div class="page-eyebrow">Application record</div>
            <div class="detail-head__no">${GM.escapeHtml(a.applicationNo)}</div>
            <div class="detail-head__sub">${statusBadge(a.status)} &nbsp;·&nbsp; ${fmtDate(a.loan.date)}</div>
          </div>
          <div class="detail-head__actions">
            <a class="btn btn--outline" href="/records/${a._id}/print"><span class="icon">🖨</span><span>Print A4</span></a>
            <a class="btn btn--primary" href="/applications/${a._id}/edit"><span class="icon">✎</span><span>Edit</span></a>
            <button class="btn btn--danger" id="deleteRecordBtn"><span class="icon">🗑</span><span>Delete</span></button>
          </div>
        </div>

        <section class="card animate-in animate-in-delay-1">
          <div class="card__header">
            <h3 class="card__title">Customer</h3>
            <span class="badge badge--neutral">${GM.escapeHtml(a.customer.mobile)}</span>
          </div>
          <div class="card__body detail-card__grid">
            ${
              a.customer.photoData
                ? `<img class="detail-photo" src="${a.customer.photoData}" alt="${GM.escapeHtml(a.customer.name)}" />`
                : `<div class="detail-photo" style="display:grid;place-items:center;color:var(--ink-300);font-size:2rem">◉</div>`
            }
            <div class="kv">
              ${kv('Full name', GM.escapeHtml(a.customer.name))}
              ${kv('Mobile', `<a href="tel:${GM.escapeHtml(a.customer.mobile)}">${GM.escapeHtml(a.customer.mobile)}</a>`, 'kv__value--small')}
              ${kv('Aadhaar', a.customer.aadhaar ? GM.escapeHtml(a.customer.aadhaar) : '<span class="text-muted">Not provided</span>', 'kv__value--small')}
              ${kv('Address', GM.escapeHtml(a.customer.address), 'kv__value--small')}
            </div>
          </div>
        </section>

        <section class="card animate-in animate-in-delay-2">
          <div class="card__header">
            <h3 class="card__title">Gold / Jewellery</h3>
            <span class="badge badge--gold">${a.jewelleryItems.length} ${a.jewelleryItems.length === 1 ? 'item' : 'items'}</span>
          </div>
          <div class="table-wrap" style="border:none">
            <div class="record-items">
              ${a.jewelleryItems.map(itemHTML).join('')}
            </div>
          </div>
          <div class="record-total">
            <span>Total weight</span>
            <span class="record-total__value">${fmtWeight(a.totalWeightGrams)}</span>
          </div>
        </section>

        <section class="card animate-in animate-in-delay-3">
          <div class="card__header">
            <h3 class="card__title">Loan</h3>
            ${statusBadge(a.status)}
          </div>
          <div class="card__body">
            <div class="loan-amount">
              <span class="mode-icon">${a.loan.paymentMode === 'cash' ? '💵' : '🏦'}</span>
              <span class="loan-amount__value">${fmtMoney(a.loan.amount)}</span>
            </div>
            <hr class="divider" />
            <div class="kv">
              ${kv('Payment mode', a.loan.paymentMode === 'cash' ? 'Cash' : 'Account', 'kv__value--small')}
              ${kv('Disbursal date', fmtDate(a.loan.date), 'kv__value--small')}
              ${a.loan.paymentMode === 'account' && (a.loan.accountDetails || {}).holderName ? `
                <hr class="divider" />
                ${kv('Account holder', GM.escapeHtml(a.loan.accountDetails.holderName), 'kv__value--small')}
                ${kv('Account number', GM.escapeHtml(a.loan.accountDetails.accountNumber || '—'), 'kv__value--small')}
                ${kv('IFSC', GM.escapeHtml(a.loan.accountDetails.ifsc || '—'), 'kv__value--small')}
              ` : ''}
            </div>
          </div>
        </section>

        <section class="card animate-in animate-in-delay-4">
          <div class="card__header">
            <h3 class="card__title">Record meta</h3>
          </div>
          <div class="card__body">
            <div class="kv">
              ${kv('Recorded by', GM.escapeHtml(a.staff ? a.staff.name : '—'), 'kv__value--small')}
              ${kv('Created', fmtDateTime(a.createdAt), 'kv__value--small')}
              ${kv('Last updated', fmtDateTime(a.updatedAt), 'kv__value--small')}
            </div>
          </div>
        </section>
      </div>`;

    root.innerHTML = jsx;

    const deleteBtn = $('#deleteRecordBtn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', openDeleteModal);
    }

    $('#deleteModalNo').textContent = a.applicationNo;
  }

  /* ---------- Delete flow ---------- */

  const modal = $('#deleteModal');

  function openDeleteModal() {
    modal.classList.add('is-open');
  }

  function closeDeleteModal() {
    modal.classList.remove('is-open');
  }

  async function confirmDelete() {
    const btn = $('#deleteConfirm');
    GM.setLoading(btn, true, 'Deleting…');
    try {
      const data = await GM.api(`/api/applications/${recordId}`, { method: 'DELETE' });
      GM.setLoading(btn, false);
      GM.toast(`${data.deletedApplicationNo} deleted`, 'danger');
      closeDeleteModal();
      setTimeout(() => (location.href = '/records'), 700);
    } catch (err) {
      GM.setLoading(btn, false);
      GM.toast(err.message, 'danger');
      closeDeleteModal();
    }
  }

  /* ---------- Load ---------- */

  async function load() {
    if (!recordId) {
      root.innerHTML = `<div class="card"><div class="empty-state"><div class="empty-state__title">Invalid record</div><div class="empty-state__text">This link is not valid.</div></div></div>`;
      return;
    }
    try {
      const data = await GM.api(`/api/applications/${recordId}`);
      render(data.application);
    } catch (err) {
      root.innerHTML = `
        <div class="card" style="background:var(--danger-bg)">
          <div class="empty-state">
            <div class="empty-state__icon" style="opacity:1">⚠</div>
            <div class="empty-state__title" style="color:var(--danger)">Record unavailable</div>
            <div class="empty-state__text">${GM.escapeHtml(err.message)}</div>
            <a class="btn btn--outline mt-2" href="/records">Back to records</a>
          </div>
        </div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    load();

    $('#deleteCancel').addEventListener('click', closeDeleteModal);
    $('#deleteConfirm').addEventListener('click', confirmDelete);

    /* close modal on backdrop click or Escape */
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeDeleteModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeDeleteModal();
    });
  });
})();