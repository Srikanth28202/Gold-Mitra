/* ============================================
   Gold Mitra — Record detail view (exact paper form match)
   ============================================ */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const root = $('#recordRoot');

  const recordId =
    (location.pathname.match(/^\/records\/([0-9a-fA-F]{24})$/) || [])[1] || null;

  const fmtWeight = (w) =>
    Number(w || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  const fmtMoney = (n) => Number(n || 0).toLocaleString('en-IN');

  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  };

  function jewelleryRowsHTML(items) {
    if (!Array.isArray(items) || !items.length) {
      return `<tr><td colspan="4" style="text-align:center;padding:14px;color:#6B7280">No gold items recorded.</td></tr>`;
    }
    return items
      .map((item, i) => {
        return `
        <tr>
          <td class="row-index" style="text-align:center;">${i + 1})</td>
          <td style="text-align:center;font-weight:600;">${GM.escapeHtml(item.purity || '—')}</td>
          <td style="text-align:center;font-weight:700;">${fmtWeight(item.weightGrams)}</td>
          <td style="text-align:center;color:#6B7280;font-size:0.8rem;">—</td>
        </tr>`;
      })
      .join('');
  }

  function render(a) {
    const custPhoto = a.customer?.photoData;
    const goldPhoto = a.jewelleryPhotoData || (a.jewelleryItems && a.jewelleryItems[0] ? a.jewelleryItems[0].photoData : '');
    const acct = a.loan?.accountDetails || a.accountDetails || {};
    const isAccount = (a.loan?.paymentMode === 'account') || !!(acct.accountNumber && acct.accountNumber !== '—');
    const totalAmt = a.totalAmountReceived || a.loan?.amount || 0;
    const declText =
      a.declaration ||
      `English\n\nDeclaration:\nI hereby declare that the above-mentioned gold items belong to me and were purchased by me or received by me as a gift. I am voluntarily selling these gold items to Gold Mitra. The details of the gold items, including their weight and quality, have been explained to me. I have read/heard and understood the above declaration and have signed it voluntarily.\n\nCustomer Signature: ____________________\nDate: ____ / ____ / ______\n\nಕನ್ನಡ\n\nಘೋಷಣೆ:\nಮೇಲ್ಕಂಡ ಚಿನ್ನದ ವಸ್ತುಗಳು ನನ್ನ ಸ್ವಂತದ್ದಾಗಿದ್ದು, ಅವುಗಳನ್ನು ನಾನು ಖರೀದಿಸಿರುತ್ತೇನೆ ಅಥವಾ ಉಡುಗೊರೆಯಾಗಿ ಪಡೆದಿರುತ್ತೇನೆ. ಈ ಚಿನ್ನದ ವಸ್ತುಗಳನ್ನು ನಾನು ಸ್ವಇಚ್ಛೆಯಿಂದ ಗೋಲ್ಡ್ ಮಿತ್ರ ಅವರಿಗೆ ಮಾರಾಟ ಮಾಡುತ್ತಿದ್ದೇನೆ. ಚಿನ್ನದ ವಸ್ತುಗಳ ತೂಕ ಮತ್ತು ಗುಣಮಟ್ಟದ ವಿವರಗಳನ್ನು ನನಗೆ ವಿವರಿಸಲಾಗಿದೆ. ಮೇಲಿನ ಘೋಷಣೆಯನ್ನು ನಾನು ಓದಿ/ಕೇಳಿ ಅರ್ಥಮಾಡಿಕೊಂಡು, ನನ್ನ ಸ್ವಇಚ್ಛೆಯಿಂದ ಸಹಿ ಮಾಡಿರುತ್ತೇನೆ.\n\nಗ್ರಾಹಕರ ಸಹಿ: ____________________\nದಿನಾಂಕ: ____ / ____ / ______`;

    const staffSigHTML = a.staffSignature
      ? `<img src="${a.staffSignature}" alt="Staff Signature" style="max-height:80px;max-width:100%;object-fit:contain;" />`
      : `<span class="canvas-placeholder" style="position:static;">Sign here</span>`;

    const custSigHTML = a.customerSignature
      ? `<img src="${a.customerSignature}" alt="Customer Signature" style="max-height:80px;max-width:100%;object-fit:contain;" />`
      : `<span class="canvas-placeholder" style="position:static;">Sign here</span>`;

    const jsx = `
      <div class="page-head no-print" style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <a href="/records" class="text-muted" style="font-size:var(--fs-sm);font-weight:var(--fw-medium);text-decoration:none;">← Back to records</a>
        </div>
        <div style="display:flex;gap:10px;">
          <a class="btn btn--outline" href="/records/${a._id}/print" target="_blank"><span class="icon">🖨</span><span>Print Document</span></a>
          <a class="btn btn--primary" href="/applications/${a._id}/edit"><span class="icon">✎</span><span>Edit</span></a>
          <button class="btn btn--danger" id="deleteRecordBtn"><span class="icon">🗑</span><span>Delete</span></button>
        </div>
      </div>

      <div class="gold-paper-form">

        <!-- 1. HEADER SECTION -->
        <header class="gold-doc-header">
          <div class="doc-brand">
            <div class="doc-logo">
              <svg width="54" height="54" viewBox="0 0 64 64" fill="none">
                <path d="M12 28L28 16L52 24L36 36L12 28Z" fill="#D4AF37" stroke="#8A6719" stroke-width="1.8"/>
                <path d="M12 28L36 36V48L12 40V28Z" fill="#B8860B" stroke="#8A6719" stroke-width="1.8"/>
                <path d="M36 36L52 24V36L36 48V36Z" fill="#E6C65A" stroke="#8A6719" stroke-width="1.8"/>
                <path d="M22 14L38 4L60 12L44 22L22 14Z" fill="#F0D675" stroke="#8A6719" stroke-width="1.8"/>
              </svg>
            </div>
            <div class="doc-brand-text">
              <h1 class="doc-title">Gold Mitra</h1>
              <p class="doc-subtitle">Trusted Gold Purchase Partner</p>
              <span class="doc-gstin-badge">GSTIN: 29BGMPB7189N224</span>
            </div>
          </div>

          <div class="doc-address">
            <p class="store-name">Gold Mitra Financial Services</p>
            <p class="store-loc">Near Neelkantaeshwara Temple,</p>
            <p class="store-loc">Hooropate Circle, Tumkur</p>
          </div>

          <div class="doc-meta-box">
            <div class="meta-row">
              <span>Date :</span> <strong>${fmtDate(a.loan?.date || a.createdAt)}</strong>
            </div>
            <div class="meta-row" style="margin-top:4px;">
              <span class="badge badge--gold">${GM.escapeHtml(a.applicationNo)}</span>
            </div>
          </div>
        </header>

        <!-- 2. CUSTOMER DETAILS SECTION -->
        <section class="form-section">
          <div class="section-banner">
            <span class="section-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </span>
            <h2 class="section-title">Customer Details</h2>
          </div>

          <div class="section-content">
            <div class="customer-grid">
              <div class="customer-fields">
                <div class="doc-field">
                  <label>Name :</label>
                  <div class="doc-input" style="background:#FAF9F5;font-weight:600;">${GM.escapeHtml(a.customer?.name || '—')}</div>
                </div>
                <div class="doc-field">
                  <label>Father name :</label>
                  <div class="doc-input" style="background:#FAF9F5;">${GM.escapeHtml(a.customer?.fatherName || '—')}</div>
                </div>
                <div class="doc-field">
                  <label>Mother name :</label>
                  <div class="doc-input" style="background:#FAF9F5;">${GM.escapeHtml(a.customer?.motherName || '—')}</div>
                </div>
                <div class="doc-field">
                  <label>Wife / Husband :</label>
                  <div class="doc-input" style="background:#FAF9F5;">${GM.escapeHtml(a.customer?.spouseName || '—')}</div>
                </div>
                <div class="doc-field">
                  <label>Work profession :</label>
                  <div class="doc-input" style="background:#FAF9F5;">${GM.escapeHtml(a.customer?.profession || '—')}</div>
                </div>
                <div class="doc-field">
                  <label>Aadhar number :</label>
                  <div class="doc-input" style="background:#FAF9F5;">${GM.escapeHtml(a.customer?.aadhaar || '—')}</div>
                </div>
                <div class="doc-field">
                  <label>Mobile number :</label>
                  <div class="doc-input" style="background:#FAF9F5;">${GM.escapeHtml(a.customer?.mobile || '—')}</div>
                </div>
              </div>

              <div class="customer-photo-box">
                <div class="photo-preview-container">
                  ${
                    custPhoto
                      ? `<img class="photo-img-preview" src="${custPhoto}" alt="Customer photo" style="display:block;" />`
                      : `<div class="photo-placeholder"><div class="avatar-circle"><svg width="38" height="38" viewBox="0 0 24 24" fill="#A4B0C0"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div><span class="photo-placeholder-text">Passport Photo</span></div>`
                  }
                </div>
              </div>
            </div>

            <div class="full-width-address-row">
              <div class="doc-field">
                <label>Address :</label>
                <div class="doc-textarea" style="background:#FAF9F5;min-height:44px;">${GM.escapeHtml(a.customer?.address || '—')}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- 3. GOLD ITEMS LIST SECTION -->
        <section class="form-section">
          <div class="section-banner">
            <span class="section-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 9l10 13L22 9 12 2zm0 3.8L18.6 9 12 17.6 5.4 9 12 5.8z"/>
              </svg>
            </span>
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
                <tbody>
                  ${jewelleryRowsHTML(a.jewelleryItems)}
                </tbody>
              </table>

              <div class="section-total-footer">
                <span class="total-label">Total weight in grams =</span>
                <div class="total-input-box">
                  <span style="font-weight:700;font-size:1.05rem;">${fmtWeight(a.totalWeightGrams)} g</span>
                </div>
              </div>
            </div>

            <div class="customer-photo-box">
              <div class="photo-preview-container" style="border:1px solid #E5E7EB;">
                ${
                  goldPhoto
                    ? `<img class="photo-img-preview" src="${goldPhoto}" alt="Gold items photo" style="display:block;" />`
                    : `<div class="photo-placeholder"><div class="avatar-circle" style="background:#FEF3C7;color:#D97706;"><svg width="38" height="38" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 9l10 13L22 9 12 2zm0 3.8L18.6 9 12 17.6 5.4 9 12 5.8z"/></svg></div><span class="photo-placeholder-text">Image of the Gold</span></div>`
                }
              </div>
            </div>
          </div>
        </section>

        <!-- 4. ACCOUNT DETAILS OF THE CUSTOMER SECTION -->
        <section class="form-section">
          <div class="section-banner">
            <span class="section-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 10h16v2H4zm0-4h16v2H4zm0 8h16v2H4zm0 4h16v2H4z"/>
              </svg>
            </span>
            <h2 class="section-title">${isAccount ? 'Account Details of the Customer' : 'Payment Details'}</h2>
          </div>

          <div class="section-content account-details-grid">
            <div class="account-table">
              <div class="acct-row" style="background:#FAF7F0;">
                <span class="acct-label">Payment mode</span>
                <div class="doc-input" style="background:transparent;border:none;font-weight:700;">${isAccount ? '🏦 Bank Transfer' : '💵 Cash'}</div>
              </div>
              ${
                isAccount
                  ? `<div class="acct-row">
                      <span class="acct-label">Account number</span>
                      <div class="doc-input" style="background:#FAF9F5;border:none;">${GM.escapeHtml(acct.accountNumber || '—')}</div>
                    </div>
                    <div class="acct-row">
                      <span class="acct-label">Name</span>
                      <div class="doc-input" style="background:#FAF9F5;border:none;">${GM.escapeHtml(acct.holderName || acct.name || '—')}</div>
                    </div>
                    <div class="acct-row">
                      <span class="acct-label">IFSC</span>
                      <div class="doc-input" style="background:#FAF9F5;border:none;">${GM.escapeHtml(acct.ifsc || '—')}</div>
                    </div>
                    <div class="acct-row">
                      <span class="acct-label">Bank</span>
                      <div class="doc-input" style="background:#FAF9F5;border:none;">${GM.escapeHtml(acct.bank || '—')}</div>
                    </div>
                    <div class="acct-row">
                      <span class="acct-label">Branch</span>
                      <div class="doc-input" style="background:#FAF9F5;border:none;">${GM.escapeHtml(acct.branch || '—')}</div>
                    </div>`
                  : ''
              }
            </div>

            <div class="section-total-footer">
              <span class="total-label">Total amount received =</span>
              <div class="total-input-box">
                <span style="font-weight:700;font-size:1.1rem;color:#111827;">₹ ${fmtMoney(totalAmt)}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- 5. DECLARATION SECTION -->
        <section class="form-section">
          <div class="section-banner">
            <span class="section-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
              </svg>
            </span>
            <h2 class="section-title">Declaration</h2>
          </div>

          <div class="section-content declaration-box">
            <span class="bullet-point">•</span>
            <div class="declaration-text-wrapper">
              <p class="decl-eng">I hereby declare that the above-mentioned gold items belong to me and were purchased by me or received by me as a gift. I am voluntarily selling these gold items to Gold Mitra. The details of the gold items, including their weight and quality, have been explained to me. I have read/heard and understood the above declaration and have signed it voluntarily.</p>
              <p class="decl-kan">ಮೇಲ್ಕಂಡ ಚಿನ್ನದ ವಸ್ತುಗಳು ನನ್ನ ಸ್ವಂತದ್ದಾಗಿದ್ದು, ಅವುಗಳನ್ನು ನಾನು ಖರೀದಿಸಿರುತ್ತೇನೆ ಅಥವಾ ಉಡುಗೊರೆಯಾಗಿ ಪಡೆದಿರುತ್ತೇನೆ. ಈ ಚಿನ್ನದ ವಸ್ತುಗಳನ್ನು ನಾನು ಸ್ವಇಚ್ಛೆಯಿಂದ ಗೋಲ್ಡ್ ಮಿತ್ರ ಅವರಿಗೆ ಮಾರಾಟ ಮಾಡುತ್ತಿದ್ದೇನೆ. ಚಿನ್ನದ ವಸ್ತುಗಳ ತೂಕ ಮತ್ತು ಗುಣಮಟ್ಟದ ವಿವರಗಳನ್ನು ನನಗೆ ವಿವರಿಸಲಾಗಿದೆ. ಮೇಲಿನ ಘೋಷಣೆಯನ್ನು ನಾನು ಓದಿ/ಕೇಳಿ ಅರ್ಥಮಾಡಿಕೊಂಡು, ನನ್ನ ಸ್ವಇಚ್ಛೆಯಿಂದ ಸಹಿ ಮಾಡಿರುತ್ತೇನೆ.</p>
            </div>
          </div>
        </section>

        <!-- 6. SIGNATURES SECTION -->
        <section class="signatures-section">
          <div class="signature-card">
            <div class="signature-card-head">
              <span class="signature-icon">✎</span>
              <span class="signature-title">Gold Mitra Staff / Admin</span>
            </div>
            <div class="physical-signature-wrap">
              <div class="signature-space"></div>
              <div class="signature-line">_______________________________</div>
              <span class="signature-subtext">Signature & Seal</span>
            </div>
          </div>

          <div class="signature-card">
            <div class="signature-card-head">
              <span class="signature-icon">✎</span>
              <span class="signature-title">Customer Signature</span>
            </div>
            <div class="physical-signature-wrap">
              <div class="signature-space"></div>
              <div class="signature-line">_______________________________</div>
              <span class="signature-subtext">Signature / Thumb Impression</span>
            </div>
          </div>
        </section>

      </div>`;

    root.innerHTML = jsx;

    const deleteBtn = $('#deleteRecordBtn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', openDeleteModal);
    }

    const modalNo = $('#deleteModalNo');
    if (modalNo) modalNo.textContent = a.applicationNo;
  }

  /* ---------- Delete Flow ---------- */

  const modal = $('#deleteModal');

  function openDeleteModal() {
    if (modal) modal.classList.add('is-open');
  }

  function closeDeleteModal() {
    if (modal) modal.classList.remove('is-open');
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

  /* ---------- Load Record ---------- */

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

    const cancelBtn = $('#deleteCancel');
    const confirmBtn = $('#deleteConfirm');
    if (cancelBtn) cancelBtn.addEventListener('click', closeDeleteModal);
    if (confirmBtn) confirmBtn.addEventListener('click', confirmDelete);

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeDeleteModal();
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && modal.classList.contains('is-open')) closeDeleteModal();
    });
  });
})();