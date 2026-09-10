/* ============================================
   Gold Mitra — New Application form logic
   ============================================ */
(function () {
  'use strict';

  const PURITY_OPTIONS = ['18K / 750', '22K / 916', '24K / 995', '14K / 585'];
  const OTHER_PURITY = 'Other';

  let uidCounter = 0;
  const uid = () => `item-${Date.now()}-${++uidCounter}`;

  const todayISO = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const state = {
    items: [makeItem()],
    paymentMode: 'cash',
    loanDate: todayISO()
  };

  const editId =
    (location.pathname.match(/^\/applications\/([0-9a-fA-F]{24})\/edit$/) || [])[1] || null;

  function makeItem() {
    return {
      id: uid(),
      itemName: '',
      purity: '',
      weight: '',
      description: '',
      photo: ''
    };
  }

  /* ---------- Element cache ---------- */

  const $ = (sel) => document.querySelector(sel);
  const form = $('#applicationForm');
  const itemsList = $('#itemsList');
  const alertsZone = $('#appAlerts');

  function showAlert(message, type = 'danger') {
    alertsZone.innerHTML = `
      <div class="alert alert--${type}">
        <span class="alert__icon">${type === 'danger' ? '✕' : 'ℹ'}</span>
        <span>${GM.escapeHtml(message)}</span>
      </div>
    `;
    alertsZone.querySelector('.alert').animate(
      [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }],
      { duration: 200, easing: 'cubic-bezier(0.22,1,0.36,1)' }
    );
  }

  function clearAlerts() {
    alertsZone.innerHTML = '';
  }

  /* ---------- Totals ---------- */

  function totalWeight() {
    return state.items.reduce((sum, it) => sum + (parseFloat(it.weight) > 0 ? parseFloat(it.weight) : 0), 0);
  }

  function fmtWeight(w) {
    return w.toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }

  function fmtMoney(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN');
  }

  function recalcTotals() {
    const w = totalWeight();
    $('#totalWeight').innerHTML =
      `${fmtWeight(w)} <span style="font-size:var(--fs-xs);color:var(--text-muted);font-weight:var(--fw-medium)">g</span>`;
    $('#totalCountText').textContent =
      `${state.items.length} ${state.items.length === 1 ? 'item' : 'items'}`;
    $('#jewelleryCount').innerHTML = `<span class="badge badge--gold">${fmtWeight(w)} g</span>`;
    $('#saveBarWeight').textContent = `${fmtWeight(w)} g`;
  }

  function recalcAmount() {
    const amt = parseFloat($('#loanAmount').value);
    $('#saveBarAmount').textContent = amt > 0 ? fmtMoney(amt) : '₹0';
  }

  /* ---------- Jewellery item rendering ---------- */

  function puritySelectHTML(item) {
    const opts = PURITY_OPTIONS.map(
      (p) => `<option value="${p}" ${item.purity === p ? 'selected' : ''}>${p}</option>`
    ).join('');
    const other = item.purity && !PURITY_OPTIONS.includes(item.purity);
    const otherOpt = other ? `<option value="${GM.escapeHtml(item.purity)}" selected>${GM.escapeHtml(item.purity)}</option>` : '';
    return `<option value="">Select purity</option>${opts}${otherOpt}`;
  }

  function itemPhotoHTML(item, index) {
    if (item.photo) {
      return `
        <div class="photo-upload photo-upload--filled" data-photo>
          <div class="photo-upload__preview-wrap">
            <img class="photo-upload__preview" src="${item.photo}" alt="Item ${index + 1} photo" />
            <div class="photo-upload__actions">
              <button type="button" class="photo-upload__action" data-change-photo="${item.id}">⟳ Change</button>
              <button type="button" class="photo-upload__action photo-upload__action--danger" data-remove-photo="${item.id}">✕ Remove</button>
            </div>
          </div>
        </div>`;
    }
    return `
      <div class="photo-upload" data-photo>
        <input type="file" accept="image/*" capture="environment" data-item-file="${item.id}" />
        <div class="photo-upload__empty">
          <span class="photo-upload__icon">◆</span>
          <span class="photo-upload__label">Item ${index + 1} photo</span>
          <span class="photo-upload__sub">Tap to capture · required</span>
        </div>
      </div>`;
  }

  function renderItems() {
    const canGoBelowOne = state.items.length === 1;
    itemsList.innerHTML = state.items
      .map((item, index) => {
        const invalidName = item.invalid && !item.itemName.trim();
        const invalidPurity = item.invalid && !item.purity;
        const invalidWeight = item.invalid && !(parseFloat(item.weight) > 0);
        const invalidPhoto = item.invalid && !item.photo;

        const klass = item.invalid ? ' item-card is-invalid' : '';
        return `
        <article class="item-card${klass}" data-item-card="${item.id}">
          <div class="item-card__head">
            <div class="item-card__title-wrap">
              <span class="item-card__chip">${index + 1}</span>
              <span class="item-card__title">Item ${index + 1}</span>
            </div>
            <button type="button" class="item-card__remove" data-remove-item="${item.id}" ${canGoBelowOne && state.items.length <= 1 ? 'disabled' : ''}>
              ✕ Remove
            </button>
          </div>

          ${itemPhotoHTML(item, index)}

          <div class="field${invalidName ? ' field--invalid' : ''}">
            <label class="field__label" for="${item.id}-name">Item name</label>
            <input class="field__input" type="text" id="${item.id}-name" value="${GM.escapeHtml(item.itemName)}" placeholder="e.g. Gold bangle / chain" />
            <span class="field__error">Item name is required.</span>
          </div>

          <div class="item-grid">
            <div class="field${invalidPurity ? ' field--invalid' : ''}">
              <label class="field__label" for="${item.id}-purity">Purity</label>
              <select class="field__select" id="${item.id}-purity">
                ${puritySelectHTML(item)}
              </select>
              <span class="field__error">Select purity.</span>
            </div>
            <div class="field${invalidWeight ? ' field--invalid' : ''}">
              <label class="field__label" for="${item.id}-weight">Weight in grams</label>
              <div class="input-unit">
                <input class="field__input" type="number" id="${item.id}-weight" inputmode="decimal" step="0.001" min="0.001" placeholder="0.000" value="${item.weight || ''}" />
                <span class="input-unit__unit">g</span>
              </div>
              <span class="field__error">Enter a valid weight.</span>
            </div>
          </div>

          <div class="field">
            <label class="field__label" for="${item.id}-desc">Description <span class="text-muted" style="text-transform:none;font-weight:var(--fw-regular)">(optional)</span></label>
            <textarea class="field__textarea" id="${item.id}-desc" rows="2" placeholder="Design, hallmark, condition, notes…">${GM.escapeHtml(item.description)}</textarea>
          </div>
        </article>`;
      })
      .join('');
    bindItemEvents();
    recalcTotals();
    updateRemoveButtons();
  }

  function bindItemEvents() {
    /* file capture for new photos */
    itemsList.querySelectorAll('input[data-item-file]').forEach((input) => {
      input.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        await capturePhoto(input.dataset.itemFile, file);
      });
    });

    /* field updates */
    itemsList.querySelectorAll('article > .field input, article > .field select, article > .item-grid input, article > .item-grid select').forEach((input) => {
      input.addEventListener('input', onItemFieldInput);
      input.addEventListener('change', onItemFieldInput);
    });

    itemsList.querySelectorAll('textarea').forEach((input) => {
      input.addEventListener('input', onItemFieldInput);
    });

    /* change / remove photo actions */
    itemsList.querySelectorAll('[data-change-photo]').forEach((btn) => {
      btn.addEventListener('click', () => dispatchItemPhotoAction('change', btn.dataset.changePhoto));
    });
    itemsList.querySelectorAll('[data-remove-photo]').forEach((btn) => {
      btn.addEventListener('click', () => dispatchItemPhotoAction('remove', btn.dataset.removePhoto));
    });

    itemsList.querySelectorAll('[data-remove-item]').forEach((btn) => {
      btn.addEventListener('click', () => removeItem(btn.dataset.removeItem));
    });
  }

  function onItemFieldInput(e) {
    const card = e.target.closest('[data-item-card]');
    if (!card) return;
    const item = state.items.find((i) => i.id === card.dataset.itemCard);
    if (!item) return;

    if (e.target.id.endsWith('-name')) item.itemName = e.target.value;
    else if (e.target.id.endsWith('-purity')) item.purity = e.target.value;
    else if (e.target.id.endsWith('-weight')) {
      item.weight = e.target.value;
      recalcTotals();
    } else if (e.target.id.endsWith('-desc')) item.description = e.target.value;

    /* Field-level live validation: clear error once user fixes it */
    if (e.target.id.endsWith('-name') && item.itemName.trim()) {
      e.target.closest('.field').classList.remove('field--invalid');
    }
    if (e.target.id.endsWith('-purity') && item.purity) {
      e.target.closest('.field').classList.remove('field--invalid');
    }
    if (e.target.id.endsWith('-weight') && parseFloat(item.weight) > 0) {
      e.target.closest('.field').classList.remove('field--invalid');
    }
  }

  function dispatchItemPhotoAction(action, id) {
    const item = state.items.find((i) => i.id === id);
    if (!item) return;

    if (action === 'remove') {
      item.photo = '';
      renderItems();
      return;
    }

    /* Re-capture: recreate a hidden file input and click it */
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      input.remove();
      if (!file) return;
      await capturePhoto(id, file);
    });
    input.click();
  }

  async function capturePhoto(id, file) {
    const item = state.items.find((i) => i.id === id);
    if (!item) return;

    const btn = $('#saveBtn');
    const req = item.photo ? 'Replacing photo…' : 'Processing photo…';
    GM.setLoading(btn, true, req);

    try {
      const dataUrl = await GM.compressImage(file);
      item.photo = dataUrl;
      renderItems();
      GM.setLoading(btn, false);
    } catch (err) {
      GM.setLoading(btn, false);
      GM.toast(err.message, 'danger');
    }
  }

  function updateRemoveButtons() {
    itemsList.querySelectorAll('[data-remove-item]').forEach((btn) => {
      btn.disabled = state.items.length <= 1;
    });
  }

  function addItem() {
    state.items.push(makeItem());
    renderItems();
    const last = state.items.length;
    requestAnimationFrame(() => {
      const input = document.getElementById(`${state.items[last - 1].id}-name`);
      if (input) input.focus();
    });
  }

  function removeItem(id) {
    if (state.items.length <= 1) return;
    state.items = state.items.filter((i) => i.id !== id);
    renderItems();
    GM.toast('Item removed', 'gold', 1600);
  }

  /* ---------- Photo loading for customer ---------- */

  function setCustomerPhotoPreview(dataUrl) {
    const wrap = $('#customerPhoto');
    wrap.classList.add('photo-upload--filled');
    wrap.innerHTML = `
        <div class="photo-upload__preview-wrap">
          <img class="photo-upload__preview" src="${dataUrl}" alt="Customer photo" />
          <div class="photo-upload__actions">
            <button type="button" class="photo-upload__action" id="customerPhotoChange">⟳ Change photo</button>
          </div>
        </div>
        <input type="file" id="customerPhotoInput" accept="image/*" capture="environment" style="display:none" />
      `;
    wrap.dataset.hasPhoto = '1';
    $('#customerPhotoChange').addEventListener('click', () => {
      document.getElementById('customerPhotoInput').click();
    });
    document.getElementById('customerPhotoInput').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) handleCustomerPhoto(f);
    });
  }

  async function handleCustomerPhoto(file) {
    const btn = $('#saveBtn');
    GM.setLoading(btn, true, 'Processing photo…');
    try {
      const dataUrl = await GM.compressImage(file);
      customerPhotoData = dataUrl;
      setCustomerPhotoPreview(dataUrl);
      GM.setLoading(btn, false);
      GM.toast('Photo captured', 'success', 1400);
      refreshCustomerBadge();
    } catch (err) {
      GM.setLoading(btn, false);
      GM.toast(err.message, 'danger');
    }
  }

  let customerPhotoData = '';

  /* ---------- Validation ---------- */

  function setFieldError(sel, hasError) {
    const el = document.querySelector(sel);
    if (!el) return;
    el.closest('.field').classList.toggle('field--invalid', hasError);
  }

  function validate() {
    let ok = true;
    const firstInvalid = [];

    /* Customer */
    const name = $('#custName').value.trim();
    const mobile = $('#custMobile').value.trim();
    const aadhaar = $('#custAadhaar').value.replace(/[\s-]/g, '');
    const address = $('#custAddress').value.trim();

    if (name.length < 2) { setFieldError('#custName', true); ok = false; firstInvalid.push('#custName'); }
    else setFieldError('#custName', false);

    if (!/^[6-9]\d{9}$/.test(mobile)) { setFieldError('#custMobile', true); ok = false; firstInvalid.push('#custMobile'); }
    else setFieldError('#custMobile', false);

    if (aadhaar && !/^\d{12}$/.test(aadhaar)) { setFieldError('#custAadhaar', true); ok = false; firstInvalid.push('#custAadhaar'); }
    else setFieldError('#custAadhaar', false);

    if (address.length < 5) { setFieldError('#custAddress', true); ok = false; firstInvalid.push('#custAddress'); }
    else setFieldError('#custAddress', false);

    if (!customerPhotoData) {
      const el = document.querySelector('#customerPhoto');
      el.style.borderColor = 'var(--danger)';
      el.style.background = 'var(--danger-bg)';
      ok = false;
      firstInvalid.push('#customerPhoto');
      GM.toast('Customer photo is required', 'danger', 2600);
    }

    /* Jewellery items */
    state.items.forEach((item) => {
      const wasInvalid = !!item.invalid;
      item.invalid = false;

      if (!item.itemName.trim()) item.invalid = true;
      if (!item.purity) item.invalid = true;
      if (!(parseFloat(item.weight) > 0)) item.invalid = true;
      if (!item.photo) item.invalid = true;

      if (item.invalid) {
        ok = false;
        if (!wasInvalid) {
          const card = document.querySelector(`[data-item-card="${item.id}"]`);
          if (card) firstInvalid.push(`[data-item-card="${item.id}"]`);
        }
      }
    });

    /* Loan */
    const amount = parseFloat($('#loanAmount').value);
    if (!(amount >= 1)) { setFieldError('#loanAmount', true); ok = false; firstInvalid.push('#loanAmount'); }
    else setFieldError('#loanAmount', false);

    if (!['cash', 'account'].includes(state.paymentMode)) ok = false;
    if (!state.loanDate) { setFieldError('#loanDate', true); ok = false; firstInvalid.push('#loanDate'); }
    else setFieldError('#loanDate', false);

    if (ok) clearAlerts();
    else {
      showAlert('Please complete the highlighted fields before saving.', 'danger');
      const target = firstInvalid.length ? firstInvalid[0] : '#custName';
      const el = document.querySelector(target);
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    renderItems();
    return ok;
  }

  /* ---------- Submit ---------- */

  async function submitApplication() {
    clearAlerts();
    if (!validate()) return;
    if (!customerPhotoData) return;

    const btn = $('#saveBtn');
    GM.setLoading(btn, true, 'Saving…');

    const payload = {
      customer: {
        name: $('#custName').value.trim(),
        mobile: $('#custMobile').value.trim(),
        aadhaar: $('#custAadhaar').value.replace(/[\s-]/g, '') || '',
        address: $('#custAddress').value.trim(),
        photoData: customerPhotoData || ''
      },
      jewelleryItems: state.items.map((item) => ({
        itemName: item.itemName.trim(),
        purity: item.purity,
        weightGrams: parseFloat(item.weight),
        description: item.description.trim(),
        photoData: item.photo || ''
      })),
      loan: {
        amount: parseFloat($('#loanAmount').value),
        paymentMode: state.paymentMode,
        date: state.loanDate
      }
    };

    try {
      const url = editId ? `/api/applications/${editId}` : '/api/applications';
      const method = editId ? 'PUT' : 'POST';
      const data = await GM.api(url, {
        method,
        body: JSON.stringify(payload)
      });

      if (data.success) {
        const badge = $('#draftBadge');
        badge.className = 'badge badge--green';
        badge.textContent = 'Saved ✓';
        btn.innerHTML = '<span>Saved ✓</span>';
        btn.disabled = true;

        GM.toast(`Application ${data.application.applicationNo} saved`, 'success', 3500);
        setTimeout(() => (location.href = editId ? `/records/${editId}` : '/'), 1300);
      }
    } catch (err) {
      GM.setLoading(btn, false);
      showAlert(err.message.replace(/^[A-Z]/, (c) => c.toLowerCase()), 'danger');
      GM.toast('Could not save application', 'danger', 3000);
    }
  }

  async function loadForEdit(id) {
    try {
      const data = await GM.api(`/api/applications/${id}`);
      const a = data.application;

      const title = document.querySelector('.app-page__topbar-title');
      if (title) title.textContent = 'Edit Application';

      const badge = $('#draftBadge');
      badge.className = 'badge badge--gold';
      badge.textContent = a.applicationNo;

      /* Customer */
      $('#custName').value = a.customer.name || '';
      $('#custMobile').value = a.customer.mobile || '';
      $('#custAadhaar').value = a.customer.aadhaar || '';
      $('#custAddress').value = a.customer.address || '';
      if (a.customer.photoData) {
        customerPhotoData = a.customer.photoData;
        setCustomerPhotoPreview(a.customer.photoData);
        refreshCustomerBadge();
      }

      /* Jewellery */
      state.items = (a.jewelleryItems || []).map((it) => ({
        id: uid(),
        itemName: it.itemName || '',
        purity: it.purity || '',
        weight: it.weightGrams != null ? String(it.weightGrams) : '',
        description: it.description || '',
        photo: it.photoData || ''
      }));
      if (!state.items.length) state.items = [makeItem()];
      renderItems();

      /* Loan */
      if (a.loan.amount != null) {
        $('#loanAmount').value = a.loan.amount;
        recalcAmount();
      }
      setPaymentMode(a.loan.paymentMode || 'cash');
      if (a.loan.date) {
        const d = new Date(a.loan.date);
        const pad = (n) => String(n).padStart(2, '0');
        state.loanDate = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
        $('#loanDate').value = state.loanDate;
      }
    } catch (err) {
      showAlert(err.message, 'danger');
      GM.toast(err.message, 'danger', 4000);
    }
  }

  function refreshCustomerBadge() {
    $('#customerDone').className = 'badge badge--green form-step__badge';
    $('#customerDone').textContent = 'Photo ✓';
  }

  /* ---------- Init ---------- */

  function setPaymentMode(mode) {
    state.paymentMode = mode;
    document.querySelectorAll('.segmented__btn').forEach((b) => {
      const active = b.dataset.mode === mode;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-checked', active ? 'true' : 'false');
    });
  }

  function init() {
    $('#loanDate').value = state.loanDate;
    $('#loanDate').max = todayISO();

    renderItems();
    recalcAmount();

    /* customer photo */
    document.getElementById('customerPhotoInput').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) handleCustomerPhoto(f);
    });

    /* loan fields */
    $('#loanAmount').addEventListener('input', () => {
      recalcAmount();
      if (parseFloat($('#loanAmount').value) >= 1) setFieldError('#loanAmount', false);
    });

    document.querySelectorAll('.segmented__btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        setPaymentMode(btn.dataset.mode);
      });
    });

    $('#loanDate').addEventListener('change', (e) => {
      state.loanDate = e.target.value || todayISO();
    });

    /* customer: clear field-level errors live */
    ['#custName', '#custMobile', '#custAadhaar', '#custAddress', '#loanAmount'].forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) el.addEventListener('input', () => setFieldError(sel, false));
    });

    $('#addItemBtn').addEventListener('click', addItem);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitApplication();
    });

    if (editId) loadForEdit(editId);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();