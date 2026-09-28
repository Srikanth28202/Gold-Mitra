/* ============================================
   Gold Mitra — receipt template
   The single source of truth for the printed document.

   Loaded two ways:
     browser  <script src="/js/receipt-template.js">  -> window.GMReceipt
     node     require('./public/js/receipt-template')  -> module.exports

   The on-screen print page and the ZIP export both render from here, so a
   receipt saved to disk can never drift from the one you print.

   Images are resolved through the caller-supplied `imageSrc` hook:
     - print page passes the data URL straight through
     - ZIP export writes each image into assets/ and points the tag at the file
   ============================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GMReceipt = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const fmtWeight = (w) =>
    Number(w || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  const fmtMoney = (n) => Number(n || 0).toLocaleString('en-IN');

  /* Mirrors the original print renderer: reads the UTC parts of loan.date.
     loan.date is stored at UTC midnight, so this yields the day the officer
     actually picked. Kept as-is so printed and exported receipts agree. */
  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  };

  function jewelleryRowsHTML(items) {
    if (!Array.isArray(items) || !items.length) {
      return `<tr><td colspan="4" style="text-align:center;padding:12px;color:#6B7280">No gold items recorded.</td></tr>`;
    }
    return items
      .map((item, i) => `
        <tr>
          <td class="row-index" style="text-align:center;font-weight:700;">${i + 1})</td>
          <td style="text-align:center;font-weight:600;">${esc(item.purity || '—')}</td>
          <td style="text-align:center;font-weight:700;">${fmtWeight(item.weightGrams)}</td>
          <td style="text-align:center;color:#6B7280;font-size:0.8rem;">—</td>
        </tr>`)
      .join('');
  }

  /* Slots the caller may want to persist. Kept explicit so the export can
     name files predictably. */
  const PHOTO_SLOTS = ['customer', 'gold', 'staff-signature', 'customer-signature'];

  function itemPhotoSlots(items) {
    if (!Array.isArray(items)) return [];
    return items.map((it, i) => ({ slot: 'item-' + (i + 1), data: it && it.photoData }));
  }

  const AVATAR_SVG =
    '<svg width="38" height="38" viewBox="0 0 24 24" fill="#A4B0C0"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';

  const GOLD_AVATAR_SVG =
    '<svg width="38" height="38" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 9l10 13L22 9 12 2zm0 3.8L18.6 9 12 17.6 5.4 9 12 5.8z"/></svg>';

  const LOGO_SVG =
    '<svg width="54" height="54" viewBox="0 0 64 64" fill="none">' +
    '<path d="M12 28L28 16L52 24L36 36L12 28Z" fill="#D4AF37" stroke="#8A6719" stroke-width="1.8"/>' +
    '<path d="M12 28L36 36V48L12 40V28Z" fill="#B8860B" stroke="#8A6719" stroke-width="1.8"/>' +
    '<path d="M36 36L52 24V36L36 48V36Z" fill="#E6C65A" stroke="#8A6719" stroke-width="1.8"/>' +
    '<path d="M22 14L38 4L60 12L44 22L22 14Z" fill="#F0D675" stroke="#8A6719" stroke-width="1.8"/>' +
    '</svg>';

  const ICON_USER =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';

  const ICON_GEM =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 9l10 13L22 9 12 2zm0 3.8L18.6 9 12 17.6 5.4 9 12 5.8z"/></svg>';

  const ICON_LIST =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4 10h16v2H4zm0-4h16v2H4zm0 8h16v2H4zm0 4h16v2H4z"/></svg>';

  const ICON_DOC =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>';

  const DECL_EN =
    'I hereby declare that the above-mentioned gold items belong to me and were purchased by me or received by me as a gift. I am voluntarily selling these gold items to Gold Mitra. The details of the gold items, including their weight and quality, have been explained to me. I have read/heard and understood the above declaration and have signed it voluntarily.';

  const DECL_KN =
    'ಮೇಲ್ಕಂಡ ಚಿನ್ನದ ವಸ್ತುಗಳು ನನ್ನ ಸ್ವಂತದ್ದಾಗಿದ್ದು, ಅವುಗಳನ್ನು ನಾನು ಖರೀದಿಸಿರುತ್ತೇನೆ ಅಥವಾ ಉಡುಗೊರೆಯಾಗಿ ಪಡೆದಿರುತ್ತೇನೆ. ಈ ಚಿನ್ನದ ವಸ್ತುಗಳನ್ನು ನಾನು ಸ್ವಇಚ್ಛೆಯಿಂದ ಗೋಲ್ಡ್ ಮಿತ್ರ ಅವರಿಗೆ ಮಾರಾಟ ಮಾಡುತ್ತಿದ್ದೇನೆ. ಚಿನ್ನದ ವಸ್ತುಗಳ ತೂಕ ಮತ್ತು ಗುಣಮಟ್ಟದ ವಿವರಗಳನ್ನು ನನಗೆ ವಿವರಿಸಲಾಗಿದೆ. ಮೇಲಿನ ಘೋಷಣೆಯನ್ನು ನಾನು ಓದಿ/ಕೇಳಿ ಅರ್ಥಮಾಡಿಕೊಂಡು, ನನ್ನ ಸ್ವಇಚ್ಛೆಯಿಂದ ಸಹಿ ಮಾಡಿರುತ್ತೇನೆ.';

  /* Render the document body (everything inside <article>). */
  function render(a, opts) {
    const options = opts || {};
    const resolve = options.imageSrc || function (d) { return d; };
    const signatures = options.signatures || { show: false, staff: '', customer: '' };

    const cust = a.customer || {};
    const loan = a.loan || {};
    const items = Array.isArray(a.jewelleryItems) ? a.jewelleryItems : [];
    const acct = loan.accountDetails || a.accountDetails || {};
    const isAccount = loan.paymentMode === 'account' || !!(acct.accountNumber && acct.accountNumber !== '—');
    const totalAmt = a.totalAmountReceived || loan.amount || 0;

    const custPhoto = cust.photoData;
    const goldPhoto = a.jewelleryPhotoData || (items[0] && items[0].photoData) || '';

    return `
      <!-- 1. HEADER SECTION -->
      <header class="gold-doc-header">
        <div class="doc-brand">
          <div class="doc-logo">${LOGO_SVG}</div>
          <div class="doc-brand-text">
            <h1 class="doc-title">Gold Mitra</h1>
            <span class="doc-gstin-badge">GSTIN: 29BGMPB7189N22ZH</span>
          </div>
        </div>

        <div class="doc-address">
          <p class="store-name">Gold Mitra</p>
          <p class="store-loc">Near Neelkantaeshwara Temple,</p>
          <p class="store-loc">Hooropate Circle, Tumkur</p>
        </div>

        <div class="doc-meta-box">
          <div class="meta-row">
            <span>Date :</span> <strong>${fmtDate(loan.date || a.createdAt)}</strong>
          </div>
          <div class="meta-row" style="margin-top:4px;">
            <span style="border:1px solid #B8860B;border-radius:4px;padding:2px 8px;font-size:0.85rem;font-weight:700;">${esc(a.applicationNo)}</span>
          </div>
        </div>
      </header>

      <!-- 2. CUSTOMER DETAILS SECTION -->
      <section class="form-section">
        <div class="section-banner">
          <span class="section-icon">${ICON_USER}</span>
          <h2 class="section-title">Customer Details</h2>
        </div>

        <div class="section-content">
          <div class="customer-grid">
            <div class="customer-fields">
              <div class="doc-field">
                <label>Name :</label>
                <div class="doc-input" style="background:#FAF9F5;font-weight:600;">${esc(cust.name || '—')}</div>
              </div>
              <div class="doc-field">
                <label>Father name :</label>
                <div class="doc-input" style="background:#FAF9F5;">${esc(cust.fatherName || '—')}</div>
              </div>
              <div class="doc-field">
                <label>Mother name :</label>
                <div class="doc-input" style="background:#FAF9F5;">${esc(cust.motherName || '—')}</div>
              </div>
              <div class="doc-field">
                <label>Wife / Husband :</label>
                <div class="doc-input" style="background:#FAF9F5;">${esc(cust.spouseName || '—')}</div>
              </div>
              <div class="doc-field">
                <label>Work profession :</label>
                <div class="doc-input" style="background:#FAF9F5;">${esc(cust.profession || '—')}</div>
              </div>
              <div class="doc-field">
                <label>Aadhar number :</label>
                <div class="doc-input" style="background:#FAF9F5;">${esc(cust.aadhaar || '—')}</div>
              </div>
              <div class="doc-field">
                <label>Mobile number :</label>
                <div class="doc-input" style="background:#FAF9F5;">${esc(cust.mobile || '—')}</div>
              </div>
            </div>

            <div class="customer-photo-box">
              <div class="photo-preview-container">
                ${
                  custPhoto
                    ? `<img class="photo-img-preview" src="${resolve(custPhoto, 'customer')}" alt="Customer photo" style="display:block;" />`
                    : `<div class="photo-placeholder"><div class="avatar-circle">${AVATAR_SVG}</div><span class="photo-placeholder-text">Passport Photo</span></div>`
                }
              </div>
            </div>
          </div>

          <div class="full-width-address-row">
            <div class="doc-field">
              <label>Address :</label>
              <div class="doc-textarea" style="background:#FAF9F5;min-height:44px;">${esc(cust.address || '—')}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- 3. GOLD ITEMS LIST SECTION -->
      <section class="form-section">
        <div class="section-banner">
          <span class="section-icon">${ICON_GEM}</span>
          <h2 class="section-title">Gold Items List</h2>
        </div>

        <div class="section-content customer-grid">
          <div class="customer-fields padding-0" style="grid-column: span 1;">
            <table class="gold-items-table">
              <thead>
                <tr>
                  <th style="width: 15%;">Sl. no</th>
                  <th style="width: 40%;">Quality</th>
                  <th style="width: 30%;">Weight in grams</th>
                  <th style="width: 15%;">Action</th>
                </tr>
              </thead>
              <tbody>${jewelleryRowsHTML(items)}</tbody>
            </table>

            <div class="section-total-footer">
              <span class="total-label">Total weight in grams =</span>
              <div class="total-input-box">
                <span style="font-weight:700;font-size:1.05rem;">${fmtWeight(a.totalWeightGrams)} g</span>
              </div>
            </div>
          </div>

          <div class="customer-photo-box">
            <div class="photo-preview-container" style="border:1px solid #E5E7EB;display:flex;align-items:center;justify-content:center;">
              ${
                goldPhoto
                  ? `<img class="photo-img-preview" src="${resolve(goldPhoto, 'gold')}" alt="Gold items photo" style="display:block;width:100%;height:100%;object-fit:cover;" />`
                  : `<div class="photo-placeholder"><div class="avatar-circle" style="background:#FEF3C7;color:#D97706;">${GOLD_AVATAR_SVG}</div><span class="photo-placeholder-text">Image of the Gold</span></div>`
              }
            </div>
          </div>
        </div>
      </section>

      <!-- 4. ACCOUNT / PAYMENT DETAILS -->
      <section class="form-section">
        <div class="section-banner">
          <span class="section-icon">${ICON_LIST}</span>
          <h2 class="section-title">${isAccount ? 'Account Details of the Customer' : 'Payment Details'}</h2>
        </div>

        <div class="section-content account-details-grid">
          <div class="account-table">
            <div class="acct-row">
              <span class="acct-label">Account number</span>
              <div class="doc-input" style="background:#FAF9F5;border:none;">${esc(acct.accountNumber || '—')}</div>
            </div>
            <div class="acct-row">
              <span class="acct-label">Name</span>
              <div class="doc-input" style="background:#FAF9F5;border:none;">${esc(acct.holderName || acct.name || '—')}</div>
            </div>
            <div class="acct-row">
              <span class="acct-label">IFSC</span>
              <div class="doc-input" style="background:#FAF9F5;border:none;">${esc(acct.ifsc || '—')}</div>
            </div>
            <div class="acct-row">
              <span class="acct-label">Bank</span>
              <div class="doc-input" style="background:#FAF9F5;border:none;">${esc(acct.bank || '—')}</div>
            </div>
            <div class="acct-row">
              <span class="acct-label">Branch</span>
              <div class="doc-input" style="background:#FAF9F5;border:none;">${esc(acct.branch || '—')}</div>
            </div>
            <div class="acct-row">
              <span class="acct-label">Cash</span>
              <div class="doc-input" style="background:#FAF9F5;border:none;">${esc(String(acct.cash || '—'))}</div>
            </div>
          </div>

          <div class="section-total-footer">
            <span class="total-label">Total amount received =</span>
            <div class="total-input-box">
              <span style="font-weight:700;font-size:1.1rem;color:#111827;">₹ ${fmtMoney(totalAmt)}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 5. DECLARATION -->
      <section class="form-section">
        <div class="section-banner">
          <span class="section-icon">${ICON_DOC}</span>
          <h2 class="section-title">Declaration</h2>
        </div>

        <div class="section-content declaration-box">
          <span class="bullet-point">&bull;</span>
          <div class="declaration-text-wrapper">
            <p class="decl-eng">${DECL_EN}</p>
            <p class="decl-kan">${DECL_KN}</p>
          </div>
        </div>
      </section>

      <!-- 6. SIGNATURES -->
      <section class="signatures-section">
        <div class="signature-block">
          ${
            signatures.show && signatures.staff
              ? `<img class="signature-image" src="${signatures.staff}" alt="Staff signature" />`
              : ''
          }
          <div class="signature-line"></div>
          <span class="signature-subtext">Gold Mitra Staff / Admin &mdash; Signature &amp; Seal</span>
        </div>

        <div class="signature-block">
          ${
            signatures.show && signatures.customer
              ? `<img class="signature-image" src="${signatures.customer}" alt="Customer signature" />`
              : ''
          }
          <div class="signature-line"></div>
          <span class="signature-subtext">Customer &mdash; Signature / Thumb Impression</span>
        </div>
      </section>`;
  }

  /* Every image slot the export should persist, flattened for the caller.
     Slots are returned even when two of them hold identical bytes - deciding
     which slots can share a single file is the caller's job, because each
     slot must still resolve to something for the renderer to point at. */
  function collectImages(a) {
    const cust = a.customer || {};
    const items = Array.isArray(a.jewelleryItems) ? a.jewelleryItems : [];
    const out = [];

    PHOTO_SLOTS.forEach((slot) => {
      if (slot === 'customer' && cust.photoData) out.push({ slot, data: cust.photoData });
      if (slot === 'gold') {
        const g = a.jewelleryPhotoData || (items[0] && items[0].photoData);
        if (g) out.push({ slot, data: g });
      }
      if (slot === 'staff-signature' && a.staffSignature) out.push({ slot, data: a.staffSignature });
      if (slot === 'customer-signature' && a.customerSignature) out.push({ slot, data: a.customerSignature });
    });

    itemPhotoSlots(items).forEach((s) => {
      if (s.data) out.push({ slot: s.slot, data: s.data });
    });

    return out;
  }

  return { render, collectImages, esc, fmtWeight, fmtMoney, fmtDate };
});
