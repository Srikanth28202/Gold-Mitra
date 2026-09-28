/* ============================================
   Gold Mitra — records download panel
   Admin-only. Sends the browser to the export endpoint, which streams a ZIP
   containing a receipt per application, index.csv and summary.html.
   ============================================ */
(function () {
  'use strict';

  const wrap = document.querySelector('.dl');
  if (!wrap) return;

  const toggle = document.getElementById('dlToggle');
  const panel = document.getElementById('dlPanel');
  const basisEl = document.getElementById('dlBasis');
  const dayField = document.getElementById('dlDayField');
  const dayEl = document.getElementById('dlDay');
  const monthField = document.getElementById('dlMonthField');
  const monthEl = document.getElementById('dlMonth');
  const goBtn = document.getElementById('dlGo');
  const statusEl = document.getElementById('dlStatus');

  /* Today in IST, matching how the server buckets records. The browser's own
     timezone would be wrong for anyone outside India. */
  function istToday() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
  }

  function istMonth() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit'
    }).format(new Date());
  }

  dayEl.value = istToday();
  monthEl.value = istMonth();

  function open(isOpen) {
    panel.classList.toggle('hidden', !isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
  }

  function say(text, kind) {
    statusEl.textContent = text || '';
    statusEl.className = 'dl__status' + (kind ? ' is-' + kind : ' hidden');
  }

  function syncFields() {
    const b = basisEl.value;
    dayField.classList.toggle('hidden', b !== 'day');
    monthField.classList.toggle('hidden', b !== 'month');
  }

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    open(panel.classList.contains('hidden'));
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) open(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') open(false);
  });

  basisEl.addEventListener('change', () => {
    syncFields();
    say('');
  });

  syncFields();

  goBtn.addEventListener('click', () => {
    const basis = basisEl.value;
    let url;

    if (basis === 'today') {
      url = '/api/export/records?basis=today';
    } else if (basis === 'day') {
      if (!dayEl.value) return say('Please choose a day.', 'error');
      url = '/api/export/records?basis=day&date=' + encodeURIComponent(dayEl.value);
    } else {
      if (!monthEl.value) return say('Please choose a month.', 'error');
      url = '/api/export/records?basis=month&date=' + encodeURIComponent(monthEl.value);
    }

    goBtn.disabled = true;
    goBtn.textContent = 'Preparing…';
    say('Building your ZIP. Large months can take a moment.', 'busy');

    /* A plain navigation so the browser handles the download natively and
       streams straight to disk without buffering the whole file in memory. */
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => {
      goBtn.disabled = false;
      goBtn.textContent = 'Download ZIP';
      say('Check your downloads folder.');
    }, 2500);
  });
})();
