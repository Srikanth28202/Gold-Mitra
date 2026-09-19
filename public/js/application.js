/* ============================================
   Gold Mitra — New Application form logic (exact spec layout)
   ============================================ */
(function () {
  'use strict';

  const PURITY_OPTIONS = ['18K / 750', '22K / 916', '24K / 995', '14K / 585', 'Other'];

  let uidCounter = 0;
  const uid = () => `item-${Date.now()}-${++uidCounter}`;

  const todayISO = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  function createEmptyItem() {
    return {
      id: uid(),
      purity: '',
      weight: '',
      photo: ''
    };
  }

  const state = {
    items: [createEmptyItem()],
    customerPhoto: '',
    goldPhoto: '',
    docDate: todayISO(),
    pageNo: '1',
    paymentMode: 'cash'
  };

  const editId = (location.pathname.match(/^\/applications\/([0-9a-fA-F]{24})\/edit$/) || [])[1] || null;

  /* ---------- DOM Caching ---------- */

  const $ = (sel) => document.querySelector(sel);

  const form = $('#applicationForm');
  const tbody = $('#goldItemsTbody');
  const alertsZone = $('#appAlerts');
  const docDateInput = $('#docDate');
  const pageNoInput = $('#pageNo');
  const totalWeightInput = $('#totalWeightInput');
  const totalAmountInput = $('#totalAmountReceived');

  const custNameInput = $('#custName');
  const custFatherNameInput = $('#custFatherName');
  const custMotherNameInput = $('#custMotherName');
  const custSpouseNameInput = $('#custSpouseName');
  const custProfessionInput = $('#custProfession');
  const custAadhaarInput = $('#custAadhaar');
  const custMobileInput = $('#custMobile');
  const custAddressInput = $('#custAddress');

  const photoPlaceholder = $('#photoPlaceholder');
  const customerPhotoImg = $('#customerPhotoImg');
  const customerPhotoInput = $('#customerPhotoInput');
  const uploadPhotoBtn = $('#uploadPhotoBtn');

  const goldPhotoPlaceholder = $('#goldPhotoPlaceholder');
  const goldPhotoImg = $('#goldPhotoImg');
  const goldPhotoInput = $('#goldPhotoInput');
  const uploadGoldPhotoBtn = $('#uploadGoldPhotoBtn');

  const modeCashRadio = $('#modeCash');
  const modeAccountRadio = $('#modeAccount');
  const bankFieldsGroup = $('#bankFieldsGroup');

  const acctNumberInput = $('#acctNumber');
  const acctNameInput = $('#acctName');
  const acctIfscInput = $('#acctIfsc');
  const acctBankInput = $('#acctBank');
  const acctBranchInput = $('#acctBranch');

  const declarationInput = $('#declarationText');

  const saveBtn = $('#saveBtn');
  const printBtn = $('#printBtn');
  const resetBtn = $('#resetBtn');
  const addItemRowBtn = $('#addItemRowBtn');

  /* ---------- Payment Mode Toggle ---------- */

  function updatePaymentModeUI() {
    const isAccount = modeAccountRadio && modeAccountRadio.checked;
    if (bankFieldsGroup) bankFieldsGroup.style.display = isAccount ? 'block' : 'none';
    state.paymentMode = isAccount ? 'account' : 'cash';
  }

  /* ---------- Alert helper ---------- */

  function showAlert(msg, type = 'danger') {
    if (!alertsZone) return;
    alertsZone.innerHTML = `
      <div class="alert alert--${type}" style="padding:10px 14px;border-radius:6px;background:#FEE2E2;border:1px solid #FCA5A5;color:#DC2626;font-size:0.88rem;display:flex;align-items:center;gap:8px;">
        <span>✕</span>
        <span>${GM.escapeHtml(msg)}</span>
      </div>
    `;
    alertsZone.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function clearAlerts() {
    if (alertsZone) alertsZone.innerHTML = '';
  }

  /* ---------- Photo Uploads ---------- */

  uploadPhotoBtn.addEventListener('click', () => customerPhotoInput.click());

  customerPhotoInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      GM.setLoading(saveBtn, true, 'Processing photo…');
      const dataUrl = await GM.compressImage(file);
      state.customerPhoto = dataUrl;
      customerPhotoImg.src = dataUrl;
      customerPhotoImg.style.display = 'block';
      photoPlaceholder.style.display = 'none';
      GM.setLoading(saveBtn, false);
      GM.toast('Photo captured', 'success', 1400);
    } catch (err) {
      GM.setLoading(saveBtn, false);
      GM.toast(err.message, 'danger');
    }
  });

  if (uploadGoldPhotoBtn && goldPhotoInput) {
    uploadGoldPhotoBtn.addEventListener('click', () => goldPhotoInput.click());

    goldPhotoInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        GM.setLoading(saveBtn, true, 'Processing gold photo…');
        const dataUrl = await GM.compressImage(file);
        state.goldPhoto = dataUrl;
        if (goldPhotoImg) {
          goldPhotoImg.src = dataUrl;
          goldPhotoImg.style.display = 'block';
        }
        if (goldPhotoPlaceholder) goldPhotoPlaceholder.style.display = 'none';
        GM.setLoading(saveBtn, false);
        GM.toast('Gold photo attached', 'success', 1400);
      } catch (err) {
        GM.setLoading(saveBtn, false);
        GM.toast(err.message, 'danger');
      }
    });
  }

  /* ---------- Gold Items Table Logic ---------- */

  function renderTableRows() {
    tbody.innerHTML = state.items
      .map((item, index) => {
        const rowNo = index + 1;
        const optsHTML = PURITY_OPTIONS.map(
          (p) => `<option value="${p}" ${item.purity === p ? 'selected' : ''}>${p}</option>`
        ).join('');

        return `
        <tr data-item-id="${item.id}">
          <td class="row-index">${rowNo})</td>
          <td>
            <select class="quality-select" data-field="purity">
              <option value="">Select quality</option>
              ${optsHTML}
            </select>
          </td>
          <td>
            <input type="number" class="weight-input" data-field="weight" step="0.001" min="0" placeholder="Enter weight (g)" value="${item.weight || ''}" />
          </td>
          <td>
            <button type="button" class="btn-delete-row" data-action="delete-row" aria-label="Delete row">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </button>
          </td>
        </tr>`;
      })
      .join('');

    bindTableEvents();
    recalcTotalWeight();
  }

  function recalcTotalWeight() {
    const sum = state.items.reduce((acc, it) => {
      const w = parseFloat(it.weight);
      return acc + (w > 0 ? w : 0);
    }, 0);
    totalWeightInput.value = sum > 0 ? sum.toFixed(3) : '0';
  }

  function bindTableEvents() {
    tbody.querySelectorAll('tr').forEach((tr) => {
      const id = tr.dataset.itemId;
      const item = state.items.find((i) => i.id === id);
      if (!item) return;

      const puritySelect = tr.querySelector('[data-field="purity"]');
      const weightInput = tr.querySelector('[data-field="weight"]');
      const deleteBtn = tr.querySelector('[data-action="delete-row"]');

      if (puritySelect) {
        puritySelect.addEventListener('change', (e) => {
          item.purity = e.target.value;
        });
      }

      if (weightInput) {
        weightInput.addEventListener('input', (e) => {
          item.weight = e.target.value;
          recalcTotalWeight();
        });
      }

      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          if (state.items.length <= 1) {
            GM.toast('At least one item row is required', 'gold');
            return;
          }
          state.items = state.items.filter((i) => i.id !== id);
          renderTableRows();
        });
      }
    });
  }

  if (addItemRowBtn) {
    addItemRowBtn.addEventListener('click', () => {
      state.items.push(createEmptyItem());
      renderTableRows();
    });
  }

  /* ---------- Print & Reset Buttons ---------- */

  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all fields?')) {
        form.reset();
        state.items = [createEmptyItem()];
        state.customerPhoto = '';
        state.goldPhoto = '';
        customerPhotoImg.style.display = 'none';
        customerPhotoImg.src = '';
        photoPlaceholder.style.display = 'flex';
        if (goldPhotoImg) {
          goldPhotoImg.style.display = 'none';
          goldPhotoImg.src = '';
        }
        if (goldPhotoPlaceholder) goldPhotoPlaceholder.style.display = 'flex';
        docDateInput.value = todayISO();
        if (pageNoInput) pageNoInput.value = '1';
        if (modeCashRadio) modeCashRadio.checked = true;
        updatePaymentModeUI();
        renderTableRows();
        clearAlerts();
        GM.toast('Form reset', 'info', 1600);
      }
    });
  }

  /* ---------- Validation & Submission ---------- */

  function validate() {
    clearAlerts();
    const name = custNameInput.value.trim();
    if (!name) {
      showAlert('Please enter customer name.', 'danger');
      custNameInput.focus();
      return false;
    }

    const mobile = custMobileInput.value.trim();
    if (!mobile) {
      showAlert('Please enter mobile number.', 'danger');
      custMobileInput.focus();
      return false;
    }
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      showAlert('Please enter a valid 10-digit mobile number starting with 6-9.', 'danger');
      custMobileInput.focus();
      return false;
    }

    const address = custAddressInput.value.trim();
    if (!address) {
      showAlert('Please enter customer address.', 'danger');
      custAddressInput.focus();
      return false;
    }

    const aadhaar = custAadhaarInput.value.trim();
    if (aadhaar && !/^\d{12}$/.test(aadhaar)) {
      showAlert('Please enter a valid 12-digit Aadhar number.', 'danger');
      custAadhaarInput.focus();
      return false;
    }

    return true;
  }

  async function submitForm() {
    if (!validate()) return;

    GM.setLoading(saveBtn, true, 'Saving…');

    const totalAmt = parseFloat(totalAmountInput.value) || 0;
    const isAccount = state.paymentMode === 'account';

    const payload = {
      pageNo: pageNoInput ? pageNoInput.value.trim() || '1' : '1',
      declaration: declarationInput.value.trim(),
      staffSignature: '',
      customerSignature: '',
      totalAmountReceived: totalAmt,

      customer: {
        name: custNameInput.value.trim(),
        fatherName: custFatherNameInput ? custFatherNameInput.value.trim() : '',
        motherName: custMotherNameInput ? custMotherNameInput.value.trim() : '',
        spouseName: custSpouseNameInput ? custSpouseNameInput.value.trim() : '',
        profession: custProfessionInput ? custProfessionInput.value.trim() : '',
        mobile: custMobileInput.value.trim(),
        aadhaar: custAadhaarInput.value.trim(),
        address: custAddressInput.value.trim(),
        photoData: state.customerPhoto
      },

      jewelleryPhotoData: state.goldPhoto,

      jewelleryItems: state.items
        .filter((it) => it.purity || parseFloat(it.weight) > 0)
        .map((it, idx) => ({
          itemName: it.purity ? `Gold Item (${it.purity})` : `Gold Item ${idx + 1}`,
          purity: it.purity || '22K / 916',
          weightGrams: parseFloat(it.weight) || 0,
          description: '',
          photoData: idx === 0 ? (state.goldPhoto || '') : ''
        })),

      accountDetails: isAccount
        ? {
            accountNumber: acctNumberInput.value.trim(),
            name: acctNameInput.value.trim(),
            ifsc: acctIfscInput.value.trim().toUpperCase(),
            bank: acctBankInput.value.trim(),
            branch: acctBranchInput.value.trim()
          }
        : {},

      loan: {
        amount: totalAmt > 0 ? totalAmt : 1,
        paymentMode: state.paymentMode,
        date: docDateInput.value || todayISO()
      }
    };

    if (!payload.jewelleryItems.length) {
      payload.jewelleryItems = [
        {
          itemName: 'Gold Item 1',
          purity: '22K / 916',
          weightGrams: 0,
          description: '',
          photoData: state.goldPhoto || ''
        }
      ];
    }

    try {
      const url = editId ? `/api/applications/${editId}` : '/api/applications';
      const method = editId ? 'PUT' : 'POST';

      const data = await GM.api(url, {
        method,
        body: JSON.stringify(payload)
      });

      if (data.success) {
        const badge = $('#draftBadge');
        if (badge) {
          badge.className = 'badge badge--green';
          badge.textContent = 'Saved ✓';
        }
        GM.toast(`Application ${data.application.applicationNo} saved successfully!`, 'success', 3000);
        setTimeout(() => (location.href = editId ? `/records/${editId}` : '/'), 1200);
      }
    } catch (err) {
      GM.setLoading(saveBtn, false);
      showAlert(err.message, 'danger');
      GM.toast('Could not save application', 'danger', 3000);
    }
  }

  /* ---------- Edit Mode Loader ---------- */

  async function loadForEdit(id) {
    try {
      const data = await GM.api(`/api/applications/${id}`);
      const a = data.application;

      const title = document.querySelector('.app-page__topbar-title');
      if (title) title.textContent = 'Edit Application';

      const badge = $('#draftBadge');
      if (badge) {
        badge.className = 'badge badge--gold';
        badge.textContent = a.applicationNo;
      }

        if (pageNoInput) pageNoInput.value = a.pageNo || '1';

      if (a.loan && a.loan.date) {
        const d = new Date(a.loan.date);
        const pad = (n) => String(n).padStart(2, '0');
        docDateInput.value = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
      }

      /* Customer */
      if (a.customer) {
        custNameInput.value = a.customer.name || '';
        if (custFatherNameInput) custFatherNameInput.value = a.customer.fatherName || '';
        if (custMotherNameInput) custMotherNameInput.value = a.customer.motherName || '';
        if (custSpouseNameInput) custSpouseNameInput.value = a.customer.spouseName || '';
        if (custProfessionInput) custProfessionInput.value = a.customer.profession || '';
        custMobileInput.value = a.customer.mobile || '';
        custAadhaarInput.value = a.customer.aadhaar || '';
        custAddressInput.value = a.customer.address || '';
        if (a.customer.photoData) {
          state.customerPhoto = a.customer.photoData;
          customerPhotoImg.src = a.customer.photoData;
          customerPhotoImg.style.display = 'block';
          photoPlaceholder.style.display = 'none';
        }
      }

      /* Gold Items Photo */
      const goldImg = a.jewelleryPhotoData || (a.jewelleryItems && a.jewelleryItems[0] ? a.jewelleryItems[0].photoData : '');
      if (goldImg) {
        state.goldPhoto = goldImg;
        if (goldPhotoImg) {
          goldPhotoImg.src = goldImg;
          goldPhotoImg.style.display = 'block';
        }
        if (goldPhotoPlaceholder) goldPhotoPlaceholder.style.display = 'none';
      }

      /* Jewellery Items */
      if (Array.isArray(a.jewelleryItems) && a.jewelleryItems.length > 0) {
        state.items = a.jewelleryItems.map((it) => ({
          id: uid(),
          purity: it.purity || '',
          weight: it.weightGrams != null ? String(it.weightGrams) : '',
          photo: it.photoData || ''
        }));
      }

      /* Payment Mode & Bank Account Details */
      const mode = a.loan?.paymentMode || 'cash';
      if (mode === 'account' && modeAccountRadio) {
        modeAccountRadio.checked = true;
      } else if (modeCashRadio) {
        modeCashRadio.checked = true;
      }
      updatePaymentModeUI();

      const ad = a.loan?.accountDetails || a.accountDetails || {};
      acctNumberInput.value = ad.accountNumber || '';
      acctNameInput.value = ad.holderName || ad.name || '';
      acctIfscInput.value = ad.ifsc || '';
      acctBankInput.value = ad.bank || '';
      acctBranchInput.value = ad.branch || '';

      totalAmountInput.value = a.totalAmountReceived || a.loan?.amount || '';

      /* Declaration */
      declarationInput.value = a.declaration || '';

      renderTableRows();
    } catch (err) {
      showAlert(err.message, 'danger');
    }
  }

  /* ---------- Init ---------- */

  function init() {
    docDateInput.value = todayISO();

    if (modeCashRadio) modeCashRadio.addEventListener('change', updatePaymentModeUI);
    if (modeAccountRadio) modeAccountRadio.addEventListener('change', updatePaymentModeUI);
    updatePaymentModeUI();

    renderTableRows();

    if (acctIfscInput) {
      acctIfscInput.addEventListener('input', () => {
        acctIfscInput.value = acctIfscInput.value.toUpperCase();
      });
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitForm();
    });

    if (editId) loadForEdit(editId);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();