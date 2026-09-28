/* ============================================
   Gold Mitra — Print Application document renderer
   Renders the exact paper document layout matching application form.

   The markup lives in receipt-template.js so that what you print and what
   lands in a downloaded ZIP bundle are always the same document.
   ============================================ */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const doc = $('#printDoc');

  const recordId =
    (location.pathname.match(/^\/records\/([0-9a-fA-F]{24})\/print$/) || [])[1] || null;

  function draw(a) {
    document.title = `Print — ${a.applicationNo} · Gold Mitra`;
    doc.innerHTML = GMReceipt.render(a, {
      imageSrc: (dataUrl) => dataUrl
    });
  }


  async function load() {
    if (!recordId) {
      doc.innerHTML = `<div style="padding:20px;color:#DC2626;text-align:center;">This link is not valid.</div>`;
      return;
    }

    try {
      const data = await GM.api(`/api/applications/${recordId}`);
      draw(data.application);
    } catch (err) {
      doc.innerHTML = `
        <div style="padding:20px;color:#DC2626;text-align:center;">
          Could not load this record for printing.<br />
          ${GM.escapeHtml(err.message)}
        </div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    load();

    const printBtn = $('#printBtn');
    if (printBtn) printBtn.addEventListener('click', () => window.print());

    const backBtn = $('#backBtn');
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (recordId) location.href = `/records/${recordId}`;
        else location.href = '/records';
      });
    }
  });
})();