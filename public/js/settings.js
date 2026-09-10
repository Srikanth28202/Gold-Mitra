/* ============================================
   Gold Mitra — Settings page
   Admin-only: field team list + create users
   ============================================ */
(function () {
  'use strict';

  const ROLE_LABEL = {
    admin: 'Admin',
    manager: 'Manager',
    'field-officer': 'Field Officer'
  };

  const $ = (s) => document.querySelector(s);
  const listEl = $('#staffList');
  const countEl = $('#staffCount');
  const emptyEl = $('#staffEmpty');
  const errorEl = $('#staffError');
  const errorText = $('#staffErrorText');

  function showListState(which) {
    listEl.classList.toggle('hidden', which !== 'list');
    emptyEl.classList.toggle('hidden', which !== 'empty');
    errorEl.classList.toggle('hidden', which !== 'error');
  }

  function memberRow(m) {
    const initials = GM.initials(m.name);
    const isActive = m.isActive !== false;
    const role = ROLE_LABEL[m.role] || m.role;
    const lastLogin = m.lastLoginAt
      ? 'Last login ' + GM.formatDate(m.lastLoginAt)
      : 'Never signed in';

    return `
      <div class="staff-row ${isActive ? '' : 'is-inactive'}">
        <div class="staff-row__avatar">${initials}</div>
        <div class="staff-row__meta">
          <div class="staff-row__name">${GM.escapeHtml(m.name)}</div>
          <div class="staff-row__sub">${GM.escapeHtml(m.email)} · ${lastLogin}</div>
        </div>
        <div class="staff-row__badges">
          <span class="badge badge--neutral">${role}</span>
          <span class="badge ${isActive ? 'badge--green' : 'badge--red'}">
            <span class="badge__dot"></span>${isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div class="staff-row__toggle">
          <button
            class="btn btn--toggle ${isActive ? 'btn--outline' : 'btn--primary'}"
            data-toggle-id="${m._id}"
            data-toggle-name="${GM.escapeHtml(m.name)}"
            data-toggle-active="${isActive}"
          >${isActive ? 'Deactivate' : 'Activate'}</button>
        </div>
      </div>`;
  }

  async function loadStaff() {
    showListState('list');
    try {
      const data = await GM.api('/api/staff');
      const staff = data.staff || [];
      countEl.textContent = staff.length + (staff.length === 1 ? ' member' : ' members');

      if (!staff.length) {
        showListState('empty');
        return;
      }

      listEl.innerHTML = staff.map(memberRow).join('');
      listEl.querySelectorAll('[data-toggle-id]').forEach((btn) => {
        btn.addEventListener('click', () => toggleMember(btn));
      });
    } catch (err) {
      countEl.textContent = 'Unavailable';
      errorText.textContent = err.message;
      showListState('error');
    }
  }

  async function toggleMember(btn) {
    const id = btn.dataset.toggleId;
    const name = btn.dataset.toggleName;
    const becomingActive = btn.dataset.toggleActive === 'false';
    GM.setLoading(btn, true, becomingActive ? 'Activating…' : 'Deactivating…');

    try {
      await GM.api('/api/staff/' + id + '/active', { method: 'PATCH' });
      GM.toast(
        `${GM.escapeHtml(name)} ${becomingActive ? 'activated' : 'deactivated'} — they can no longer sign in.`,
        becomingActive ? 'success' : 'gold',
        3000
      );
      loadStaff();
    } catch (err) {
      GM.toast(err.message, 'danger');
      GM.setLoading(btn, false);
    }
  }

  /* ---------------- Create form ---------------- */

  function setError(id, msg) {
    const field = $(`#${id}`).closest('.field');
    field.classList.toggle('field--invalid', Boolean(msg));
    field.querySelector('.field__error').textContent = msg || '';
  }

  function validate(form) {
    const name = $('#memberName').value.trim();
    const email = $('#memberEmail').value.trim();
    const phone = $('#memberPhone').value.trim();
    const password = $('#memberPassword').value;
    const confirm = $('#memberConfirm').value;

    setError('memberName', name.length >= 2 ? '' : 'Full name is required');
    setError('memberEmail', /^\S+@\S+\.\S+$/.test(email) ? '' : 'Enter a valid email address');
    setError('memberPhone', !phone || /^[6-9]\d{9}$/.test(phone) ? '' : 'Enter a valid 10-digit mobile');
    setError('memberPassword', password.length >= 8 ? '' : 'Password must be at least 8 characters');
    setError('memberConfirm', confirm === password && password.length >= 8 ? '' : 'Passwords do not match');

    return !form.querySelector('.field--invalid');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = $('#memberForm');
    const createBtn = $('#createBtn');

    $('#staffRetry').addEventListener('click', loadStaff);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validate(form)) {
        GM.toast('Please fix the highlighted fields.', 'danger', 2800);
        return;
      }

      GM.setLoading(createBtn, true, 'Creating…');
      try {
        await GM.api('/api/staff', {
          method: 'POST',
          body: JSON.stringify({
            name: $('#memberName').value.trim(),
            email: $('#memberEmail').value.trim(),
            phone: $('#memberPhone').value.trim(),
            role: $('#memberRole').value,
            password: $('#memberPassword').value
          })
        });
        GM.toast(`${$('#memberName').value.trim()} added to the team`, 'success', 3200);
        form.reset();
        loadStaff();
      } catch (err) {
        GM.toast(err.message, 'danger', 3600);
      } finally {
        GM.setLoading(createBtn, false);
      }
    });

    ['memberName', 'memberEmail', 'memberPhone', 'memberPassword', 'memberConfirm'].forEach((id) => {
      $('#' + id).addEventListener('input', () => {
        const field = $('#' + id).closest('.field');
        field.classList.remove('field--invalid');
        field.querySelector('.field__error').textContent = '';
      });
    });

    loadStaff();
  });
})();