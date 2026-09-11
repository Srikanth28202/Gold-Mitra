/* ============================================
   Gold Mitra — A4 loan application renderer
   Standalone page: fetches the record via API
   and renders the professional paper document.
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
    if (Number.isNaN(d.getTime())) return '—';
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

  /* ---------- Amount in words (Indian numbering) ---------- */

  const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const twoDigits = (n) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''));
  const threeDigits = (n) => {
    const h = Math.floor(n / 100), r = n % 100;
    let s = h ? ONES[h] + ' Hundred' : '';
    if (r) s += (s ? ' ' : '') + twoDigits(r);
    return s;
  };

  const amountInWords = (n) => {
    const num = Math.trunc(Number(n) || 0);
    if (!num) return 'Zero Rupees Only';
    const crore = Math.floor(num / 10000000), rem1 = num % 10000000;
    const lakh = Math.floor(rem1 / 100000), rem2 = rem1 % 100000;
    const thous = Math.floor(rem2 / 1000), rem3 = rem2 % 1000;
    let s = '';
    if (crore) s += twoDigits(crore) + ' Crore';
    if (lakh) s += (s ? ' ' : '') + twoDigits(lakh) + ' Lakh';
    if (thous) s += (s ? ' ' : '') + twoDigits(thous) + ' Thousand';
    const h = threeDigits(rem3);
    if (h) s += (s ? ' ' : '') + h;
    return (s + ' Rupees').trim() + ' Only';
  };

  /* ---------- Sections ---------- */

  function jewelleryRows(items) {
    return items
      .map((item, i) => {
        const photo = item.photoData
          ? `<img class="pd-table__thumb" src="${item.photoData}" alt="Item ${i + 1}" />`
          : `<span class="pd-table__thumb pd-table__thumb--empty">◆</span>`;
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

  const TERMS = [
    'The gold jewellery pledged herein is subject to independent verification of purity, weight and valuation by Gold Mitra. Loan eligibility, margin and interest rate shall be decided by Gold Mitra in accordance with its lending policy.',
    'The pledged gold remains the property of the customer and is held by Gold Mitra as security under a first and continuing pledge until the loan together with interest and all charges is fully repaid.',
    'Interest accrues from the date of disbursal. Repayments are due in accordance with the schedule agreed at the time of sanction. Delay or default attracts penal interest and recovery action as per policy.',
    'The customer shall preserve this application and its acknowledgement. Redemption shall be made, as per Gold Mitra policy, against full settlement of dues and surrender of all documents and jewellery receipts.',
    'KYC documents submitted with this application shall be verified. Any false, forged or misleading information shall render the loan void and may attract legal action.',
    'Gold Mitra may value, insure and, if required, realize the pledged gold should the customer fail to redeem within the applicable period. Any surplus or deficit shall be dealt with as per applicable law.',
    'This application is subject to applicable laws and regulations. Any dispute arising thereunder shall be subject to the jurisdiction of the competent courts locally.',
    'Force majeure, regulatory or policy changes may affect the terms herein, and such changes shall be binding once intimated in writing.'
  ];

  function termsHTML() {
    return TERMS.map(
      (t, i) => `<div class="pd-term"><span class="pd-term__num">${i + 1}.</span><span class="pd-term__text">${t}</span></div>`
    ).join('');
  }

  function render(a, sessionUser) {
    const n = a.jewelleryItems.length;
    const status = STATUS[a.status] || STATUS.pending;
    const isAccount = a.loan.paymentMode === 'account' && (a.loan.accountDetails || {}).holderName;
    const place = esc(a.customer.address.split(',').pop().trim() || 'Date');

    document.title = `Print — ${a.applicationNo} · Gold Mitra`;

    doc.innerHTML = `
      <div class="pd-watermark" aria-hidden="true">Gold Mitra</div>

      <!-- ============ Header ============ -->
      <header class="pd-header">
        <div class="pd-brand">
          <span class="pd-brand__mark">GM</span>
          <span class="pd-brand__text">
            <span class="pd-brand__name">GOLD MITRA</span>
            <span class="pd-brand__tagline">Gold Loan Services</span>
            <span class="pd-brand__addr">Gold Mitra Microfin · India</span>
          </span>
        </div>
        <div class="pd-heading">
          <div class="pd-kicker">Loan Application · Hard Copy</div>
          <div class="pd-title">GOLD LOAN APPLICATION</div>
          <span class="pd-no">${esc(a.applicationNo)}</span>
        </div>
      </header>

      <div class="pd-rule"></div>

      <!-- ============ Meta ============ -->
      <div class="pd-meta">
        <span class="pd-meta__item">
          <span class="pd-meta__label">Loan number</span>
          <span class="pd-meta__value">${esc(a.applicationNo)}</span>
        </span>
        <span class="pd-meta__item">
          <span class="pd-meta__label">Application date</span>
          <span class="pd-meta__value">${esc(formatDate(a.createdAt))}</span>
        </span>
        <span class="pd-meta__item">
          <span class="pd-meta__label">Loan date</span>
          <span class="pd-meta__value">${esc(formatDate(a.loan.date))}</span>
        </span>
        <span class="pd-meta__item">
          <span class="pd-meta__label">Payment mode</span>
          <span class="pd-meta__value">${a.loan.paymentMode === 'cash' ? 'Cash' : 'Bank transfer'}</span>
        </span>
        <span class="pd-meta__item">
          <span class="pd-meta__label">Status</span>
          <span class="pd-status ${status.cls}"><span class="pd-status__dot"></span>${status.label}</span>
        </span>
        <span class="pd-meta__item pd-meta__item--push">
          <span class="pd-meta__label">Prepared by</span>
          <span class="pd-meta__value">${esc(a.staff ? a.staff.name : '—')}</span>
        </span>
      </div>

      <!-- ============ 1. Customer ============ -->
      <section class="pd-section">
        <h2 class="pd-section__title"><span class="pd-section__num">1</span>Customer / Applicant details</h2>
        <div class="pd-customer">
          ${
            a.customer.photoData
              ? `<img class="pd-customer__photo" src="${a.customer.photoData}" alt="Customer photo" />`
              : `<div class="pd-customer__photo pd-customer__photo--empty">◉</div>`
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
              <div class="pd-field__value">${esc(a.customer.address || '—')}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- ============ 2. Jewellery ============ -->
      <section class="pd-section">
        <h2 class="pd-section__title"><span class="pd-section__num">2</span>Gold / Jewellery particulars</h2>
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

      <!-- ============ 3. Loan ============ -->
      <section class="pd-section">
        <h2 class="pd-section__title"><span class="pd-section__num">3</span>Loan / Amount details</h2>
        <div class="pd-loan">
          <div class="pd-loan__box pd-loan__box--amount">
            <div class="pd-loan__label">Loan amount</div>
            <div class="pd-loan__value">${formatINR(a.loan.amount)}</div>
          </div>
          <div class="pd-loan__box">
            <div class="pd-loan__label">Payment mode</div>
            <div class="pd-loan__value pd-loan__value--small">${a.loan.paymentMode === 'cash' ? 'Cash' : 'Bank transfer'}</div>
          </div>
          <div class="pd-loan__box">
            <div class="pd-loan__label">Loan date</div>
            <div class="pd-loan__value pd-loan__value--small">${esc(formatDate(a.loan.date))}</div>
          </div>
        </div>
        <div class="pd-amount-words">
          <span class="pd-amount-words__label">Amount in words</span>
          <span class="pd-amount-words__value">${esc(amountInWords(a.loan.amount))}</span>
        </div>
        ${isAccount ? `
          <div class="pd-account">
            <div class="pd-account__row"><span class="pd-account__label">Account holder</span><span class="pd-account__value">${esc(a.loan.accountDetails.holderName)}</span></div>
            <div class="pd-account__row"><span class="pd-account__label">Account number</span><span class="pd-account__value">${esc(a.loan.accountDetails.accountNumber || '—')}</span></div>
            <div class="pd-account__row"><span class="pd-account__label">IFSC</span><span class="pd-account__value">${esc(a.loan.accountDetails.ifsc || '—')}</span></div>
          </div>` : ''}
      </section>

      <!-- ============ 4. Terms ============ -->
      <section class="pd-section">
        <h2 class="pd-section__title"><span class="pd-section__num">4</span>Important terms &amp; conditions</h2>
        <div class="pd-terms">${termsHTML()}</div>
      </section>

      <!-- ============ 5. Declaration ============ -->
      <section class="pd-section">
        <h2 class="pd-section__title"><span class="pd-section__num">5</span>Declaration &amp; signatures</h2>

        <div class="pd-declaration">
          <strong>Declaration.</strong> I, <strong>${esc(a.customer.name)}</strong>, hereby declare that the
          jewellery described above (total <strong>${formatWeight(a.totalWeightGrams)}</strong>) is legally and
          exclusively owned by me and is free from all encumbrances. I have handed over the said jewellery to
          Gold Mitra as security against a gold loan of <strong>${formatINR(a.loan.amount)}</strong>
          (${esc(amountInWords(a.loan.amount))}) disbursed in
          <strong>${a.loan.paymentMode === 'cash' ? 'cash' : 'bank transfer'}</strong>. I confirm that the
          information furnished in this application is true and correct and I agree to the terms and conditions
          printed above.
        </div>

        <div class="pd-place-date">
          <span class="pd-place-date__item"><span class="pd-field__label">Place</span><span>${place}</span></span>
          <span class="pd-place-date__item"><span class="pd-field__label">Date</span><span>${esc(formatDate(a.loan.date))}</span></span>
        </div>

        <div class="pd-sig-grid">
          <div class="pd-sig">
            <div class="pd-sig__title">Customer / Pledger</div>
            <div class="pd-sig__name">${esc(a.customer.name)}</div>
            <div class="pd-sig__role">Signature / thumb impression</div>
            <div class="pd-sig__line">Signature</div>
          </div>
          <div class="pd-sig">
            <div class="pd-sig__title">Prepared by · Field Officer</div>
            <div class="pd-sig__name">${esc(a.staff ? a.staff.name : '—')}</div>
            <div class="pd-sig__role">${esc(a.staff && a.staff.role ? a.staff.role.replace('-', ' ') : '')}</div>
            <div class="pd-sig__line">Signature</div>
          </div>
          <div class="pd-sig">
            <div class="pd-sig__title">Authorized Signatory</div>
            <div class="pd-sig__name">&nbsp;</div>
            <div class="pd-sig__role">Branch authority · Gold Mitra</div>
            <div class="pd-sig__line">Signature</div>
            <div class="pd-sig__stamp">Official stamp</div>
          </div>
        </div>
      </section>

      <!-- ============ Footer ============ -->
      <footer class="pd-footer">
        <div class="pd-footer__note">
          <span>This is a computer-generated document from Gold Mitra.</span>
          <span>Printed by ${esc(sessionUser)} · ${esc(formatDateTime(new Date()))}</span>
        </div>
        <div class="pd-footer__terms">
          Gold jewellery pledged as security is subject to verification of purity and weight. Valuation,
          interest rate and loan eligibility are determined by Gold Mitra in accordance with its lending
          policy. This document does not by itself authorize release or redemption of jewellery.
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