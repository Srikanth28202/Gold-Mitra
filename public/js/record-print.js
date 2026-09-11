/* ============================================
   Gold Mitra — A4 print document renderer
   Standalone page: fetches the record via API
   and renders a professional paper document.
   ============================================ */
(function () {
  'use strict';

  const STATUS = {
    pending: { label: 'Pending', cls: 'pd-status--pending' },
    approved: { label: 'Approved', cls: 'pd-status--approved' },
    rejected: { label: 'Rejected', cls: 'pd-status--rejected' },
    disbursed: { label: 'Disbursed', cls: 'pd-status--disbursed' }
  };

  const $ = (s) => document.querySelector(s);
  const doc = $('#printDoc');

  const recordId =
    (location.pathname.match(/^\/records\/([0-9a-fA-F]{24})\/print$/) || [])[1] || null;

  const esc = (v, fallback = '—') => {
    const s = (v ?? '') === '' ? fallback : String(v);
    return GM.escapeHtml(s);
  };

  const formatINR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const formatWeight = (w) =>
    Number(w || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' g';

  const pad = (n) => String(n).padStart(2, '0');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };

  const formatDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return (
      d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' · ' +
      d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    );
  };

  const formatAadhaar = (v) => {
    const digits = String(v || '').replace(/\D/g, '');
    if (!digits) return '—';
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  };

  function jewelleryRows(items) {
    return items
      .map((item, i) => {
        const photo = item.photoData
          ? `<img class="pd-table__thumb" src="${item.photoData}" alt="Item ${i + 1}" />`
          : `<span class="pd-table__thumb" style="display:inline-grid;place-items:center;color:#B9BEC9">◆</span>`;
        const desc = item.description
          ? `<div class="pd-table__item-desc">${esc(item.description)}</div>`
          : '';
        return `
          <tr>
            <td class="pd-table__cell-index">${i + 1}</td>
            <td class="pd-table__cell-photo">${photo}</td>
            <td>
              <span class="pd-table__item-name">${esc(item.itemName)}</span>${desc}
            </td>
            <td>${esc(item.purity)}</td>
            <td class="pd-table__cell-weight">${formatWeight(item.weightGrams)}</td>
          </tr>`;
      })
      .join('');
  }

  function render(a, sessionUser) {
    const n = a.jewelleryItems.length;
    const status = STATUS[a.status] || STATUS.pending;

    document.title = `Print — ${a.applicationNo} · Gold Mitra`;

    doc.innerHTML = `
      <!-- Header -->
      <div class="pd-header">
        <div class="pd-brand">
          <span class="pd-brand__mark">GM</span>
          <span>
            <div class="pd-brand__name">GOLD MITRA</div>
            <div class="pd-brand__tagline">Field Loan Suite</div>
          </span>
        </div>
        <div class="pd-heading">
          <div class="pd-kicker">Document · Hard Copy</div>
          <div class="pd-title">Gold Loan Application</div>
          <span class="pd-no">${esc(a.applicationNo)}</span>
        </div>
      </div>

      <div class="pd-rule"></div>

      <!-- Meta -->
      <div class="pd-meta">
        <span class="pd-meta__item">
          <span class="pd-meta__label">Application date</span>
          <span class="pd-meta__value">${esc(formatDate(a.loan.date))}</span>
        </span>
        <span class="pd-meta__item">
          <span class="pd-meta__label">Payment mode</span>
          <span class="pd-meta__value">${a.loan.paymentMode === 'cash' ? 'Cash' : 'Account'}</span>
        </span>
        <span class="pd-meta__item">
          <span class="pd-meta__label">Status</span>
          <span class="pd-status ${status.cls}"><span class="pd-status__dot"></span>${status.label}</span>
        </span>
        <span class="pd-meta__item">
          <span class="pd-meta__label">Recorded by</span>
          <span class="pd-meta__value">${esc(a.staff ? a.staff.name : '—')}</span>
        </span>
      </div>

      <!-- 1. Customer -->
      <section class="pd-section">
        <h2 class="pd-section__title"><span class="pd-section__num">1</span>Customer details</h2>
        <div class="pd-customer">
          ${
            a.customer.photoData
              ? `<img class="pd-customer__photo" src="${a.customer.photoData}" alt="Customer photo" />`
              : `<div class="pd-customer__photo" style="display:grid;place-items:center;color:#B9BEC9;font-size:16pt">◉</div>`
          }
          <div class="pd-customer__fields">
            <div class="pd-field">
              <div class="pd-field__label">Full name</div>
              <div class="pd-field__value">${esc(a.customer.name)}</div>
            </div>
            <div class="pd-field">
              <div class="pd-field__grid">
                <div>
                  <div class="pd-field__label">Mobile number</div>
                  <div class="pd-field__value">${esc(a.customer.mobile)}</div>
                </div>
                <div>
                  <div class="pd-field__label">Aadhaar number</div>
                  <div class="pd-field__value">${esc(formatAadhaar(a.customer.aadhaar))}</div>
                </div>
              </div>
            </div>
            <div class="pd-field">
              <div class="pd-field__label">Address</div>
              <div class="pd-field__value">${esc(a.customer.address)}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- 2. Jewellery -->
      <section class="pd-section">
        <h2 class="pd-section__title"><span class="pd-section__num">2</span>Jewellery particulars</h2>
        <table class="pd-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Photo</th>
              <th>Item &amp; description</th>
              <th>Purity</th>
              <th style="text-align:right">Weight</th>
            </tr>
          </thead>
          <tbody>
            ${jewelleryRows(a.jewelleryItems)}
            <tr class="pd-row-total">
              <td colspan="2"></td>
              <td style="text-transform:uppercase;letter-spacing:0.04em">
                Total — ${n} ${n === 1 ? 'item' : 'items'}
              </td>
              <td></td>
              <td class="pd-table__cell-weight">${formatWeight(a.totalWeightGrams)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- 3. Loan -->
      <section class="pd-section">
        <h2 class="pd-section__title"><span class="pd-section__num">3</span>Loan details</h2>
        <div class="pd-loan">
          <div class="pd-loan__box pd-loan__box--amount">
            <div class="pd-loan__label">Loan amount</div>
            <div class="pd-loan__value">${formatINR(a.loan.amount)}</div>
          </div>
          <div class="pd-loan__box">
            <div class="pd-loan__label">Payment mode</div>
            <div class="pd-loan__value pd-loan__value--small">${a.loan.paymentMode === 'cash' ? 'Cash 💵' : 'Account 🏦'}</div>
          </div>
          <div class="pd-loan__box">
            <div class="pd-loan__label">Loan date</div>
            <div class="pd-loan__value pd-loan__value--small">${esc(formatDate(a.loan.date))}</div>
          </div>
        </div>
        ${a.loan.paymentMode === 'account' && (a.loan.accountDetails || {}).holderName ? `
          <div class="pd-account">
            <div class="pd-account__row">
              <span class="pd-account__label">Account holder</span>
              <span class="pd-account__value">${esc(a.loan.accountDetails.holderName)}</span>
            </div>
            <div class="pd-account__row">
              <span class="pd-account__label">Account number</span>
              <span class="pd-account__value">${esc(a.loan.accountDetails.accountNumber || '—')}</span>
            </div>
            <div class="pd-account__row">
              <span class="pd-account__label">IFSC</span>
              <span class="pd-account__value">${esc(a.loan.accountDetails.ifsc || '—')}</span>
            </div>
          </div>` : ''}
      </section>

      <!-- 4. Declaration -->
      <section class="pd-section">
        <h2 class="pd-section__title"><span class="pd-section__num">4</span>Declaration &amp; signatures</h2>

        <div class="pd-declaration">
          I, <strong>${esc(a.customer.name)}</strong>, hereby declare that the jewellery described above
          (total <strong>${formatWeight(a.totalWeightGrams)}</strong>) is legally owned by me, has been
          handed over to Gold Mitra as security against a loan of
          <strong>${formatINR(a.loan.amount)}</strong> disbursed in
          <strong>${a.loan.paymentMode === 'cash' ? 'Cash' : 'Account transfer'}</strong>.
          I agree to the applicable interest, valuation and redemption terms of Gold Mitra.
        </div>

        <div class="pd-acknowledgement">
          <strong>Customer acknowledgement &amp; receipt</strong> — I confirm receipt of this
          application document and acknowledge the pledge of the above gold jewellery.
          <div class="pd-field__line">Customer signature</div>
        </div>

        <div class="pd-sig-grid">
          <div class="pd-sig">
            <div class="pd-sig__title">Prepared by · Field Officer</div>
            <div class="pd-sig__name">${esc(a.staff ? a.staff.name : '—')}</div>
            <div class="pd-sig__role">${esc(a.staff && a.staff.role ? a.staff.role.replace('-', ' ') : '')}</div>
            <div class="pd-sig__line">Signature</div>
          </div>
          <div class="pd-sig">
            <div class="pd-sig__title">Reviewed by</div>
            <div class="pd-sig__name">&nbsp;</div>
            <div class="pd-sig__role">Branch authority</div>
            <div class="pd-sig__line">Signature</div>
          </div>
          <div class="pd-sig">
            <div class="pd-sig__title">Authorized signatory</div>
            <div class="pd-sig__name">&nbsp;</div>
            <div class="pd-sig__role">Gold Mitra</div>
            <div class="pd-sig__line">Signature</div>
            <div class="pd-sig__stamp">Official stamp</div>
          </div>
        </div>
      </section>

      <!-- Footer -->
      <footer class="pd-footer">
        <div class="pd-footer__note">
          <span>This is a computer-generated document from Gold Mitra.</span>
          <span>Printed by ${esc(sessionUser)} · ${esc(formatDateTime(new Date()))}</span>
        </div>
        <div class="pd-footer__terms">
          Gold jewellery pledged as security is subject to verification of purity and weight.
          Valuation, interest rate and loan eligibility are determined by Gold Mitra as per its
          lending policy. This document does not authorize release or redemption of jewellery.
        </div>
      </footer>`;
  }

  async function load() {
    if (!recordId) {
      doc.innerHTML = `<div class="print-doc__error">This link is not valid.</div>`;
      return;
    }

    try {
      const [data, me] = await Promise.all([
        GM.api(`/api/applications/${recordId}`),
        GM.api('/api/auth/me').catch(() => ({ user: {} }))
      ]);
      render(data.application, me.user.name || '—');
    } catch (err) {
      doc.innerHTML = `
        <div class="print-doc__error">
          Could not load this record for printing.<br />
          ${esc(err.message)}
        </div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    load();

    $('#printBtn').addEventListener('click', () => window.print());

    $('#backBtn').addEventListener('click', (e) => {
      e.preventDefault();
      if (recordId) location.href = `/records/${recordId}`;
      else location.href = '/records';
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        /* let the browser's native print run on the document itself */
      }
    });
  });
})();