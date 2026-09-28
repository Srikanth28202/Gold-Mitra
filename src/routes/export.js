const express = require('express');
const { ZipArchive } = require('archiver');
const fs = require('fs');
const path = require('path');

const { requireAuth, requireAdmin } = require('../middleware/auth');
const { isConnected } = require('../config/db');
const {
  istDayRange,
  istMonthRange,
  istDateKey,
  istEndOfDay
} = require('../config/dates');
const Application = require('../models/Application');
const receipt = require('../../public/js/receipt-template');

const router = express.Router();

/* A month of field records is well under this. The cap exists so a runaway
   request cannot tie up the server streaming a huge archive. */
const MAX_RECORDS = 500;

const CSS_FILES = [
  'variables.css',
  'base.css',
  'components.css',
  'application.css',
  'print.css'
];

const CSS_DIR = path.join(__dirname, '..', '..', 'public', 'css');

/* ---------------------------------------------------------------- helpers */

/* "data:image/jpeg;base64,...." -> { buffer, ext } */
function decodeDataUrl(dataUrl) {
  const m = /^data:([\w/+.-]+);base64,(.*)$/s.exec(String(dataUrl || ''));
  if (!m) return null;
  try {
    const ext = (m[1].split('/')[1] || 'bin').split('+')[0];
    return { buffer: Buffer.from(m[2], 'base64'), ext: ext === 'jpeg' ? 'jpg' : ext };
  } catch (err) {
    return null;
  }
}

function safeName(s) {
  return String(s || 'record').replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 80);
}

/* Bundle each image once per record; later slots reuse the same file. */
function planImages(app) {
  const raw = receipt.collectImages(app);
  const files = [];      // { name, buffer }
  const bySlot = {};    // slot -> relative path from receipts/
  const byData = {};    // dataUrl -> relative path, so duplicates collapse

  raw.forEach((img) => {
    const decoded = decodeDataUrl(img.data);
    if (!decoded) return;

    if (byData[img.data]) {
      bySlot[img.slot] = byData[img.data];
      return;
    }

    const name = `${safeName(app.applicationNo)}-${safeName(img.slot)}.${decoded.ext}`;
    files.push({ name, buffer: decoded.buffer });
    bySlot[img.slot] = `../assets/${name}`;
    byData[img.data] = bySlot[img.slot];
  });

  return { files, bySlot };
}

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  // Guard against spreadsheet formula injection from customer-supplied text.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function buildCsv(apps) {
  const headers = [
    'Application No', 'Date', 'Customer Name', 'Mobile', 'Aadhaar',
    'Father Name', 'Mother Name', 'Spouse Name', 'Profession', 'Address',
    'Total Weight (g)', 'Total Amount', 'Payment Mode', 'Account Number',
    'Account Holder', 'IFSC', 'Bank', 'Branch', 'Cash',
    'Gold Items', 'Staff Name', 'Registered On', 'Receipt File'
  ];

  const rows = apps.map((a) => {
    const c = a.customer || {};
    const l = a.loan || {};
    const ac = l.accountDetails || {};
    const items = (a.jewelleryItems || [])
      .map((it, i) => `${i + 1}. ${it.purity || ''} - ${receipt.fmtWeight(it.weightGrams)}g`)
      .join(' | ');

    return [
      a.applicationNo,
      receipt.fmtDate(l.date || a.createdAt),
      c.name, c.mobile, c.aadhaar, c.fatherName, c.motherName,
      c.spouseName, c.profession, c.address,
      receipt.fmtWeight(a.totalWeightGrams),
      receipt.fmtMoney(a.totalAmountReceived || l.amount || 0),
      l.paymentMode,
      ac.accountNumber, ac.holderName, ac.ifsc, ac.bank, ac.branch, ac.cash,
      items,
      (a.staff && a.staff.name) || '',
      new Date(a.createdAt).toISOString(),
      `receipts/${safeName(a.applicationNo)}.html`
    ].map(csvCell).join(',');
  });

  // BOM so Excel opens the Kannada/₹ characters correctly.
  return '﻿' + [headers.map(csvCell).join(','), ...rows].join('\r\n') + '\r\n';
}

function buildSummaryHtml(apps, meta) {
  const esc = receipt.esc;
  const totalWeight = apps.reduce((s, a) => s + (a.totalWeightGrams || 0), 0);
  const totalAmount = apps.reduce((s, a) => s + (a.totalAmountReceived || (a.loan || {}).amount || 0), 0);

  const rows = apps.map((a) => `
    <tr>
      <td><a href="receipts/${safeName(a.applicationNo)}.html">${esc(a.applicationNo)}</a></td>
      <td>${esc(receipt.fmtDate((a.loan || {}).date || a.createdAt))}</td>
      <td>${esc((a.customer || {}).name || '—')}</td>
      <td>${esc((a.customer || {}).mobile || '—')}</td>
      <td class="num">${esc(receipt.fmtWeight(a.totalWeightGrams))}</td>
      <td class="num">₹ ${esc(receipt.fmtMoney(a.totalAmountReceived || (a.loan || {}).amount || 0))}</td>
    </tr>`).join('');

  const body = apps.length
    ? `<table>
        <thead><tr>
          <th>Application No</th><th>Date</th><th>Customer</th>
          <th>Mobile</th><th class="num">Weight (g)</th><th class="num">Amount</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
          <th colspan="4">Total — ${apps.length} application${apps.length === 1 ? '' : 's'}</th>
          <th class="num">${esc(receipt.fmtWeight(totalWeight))}</th>
          <th class="num">₹ ${esc(receipt.fmtMoney(totalAmount))}</th>
        </tr></tfoot>
      </table>`
    : `<p class="empty">No applications were recorded for this ${esc(meta.basis)}.</p>`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Gold Mitra — Records ${esc(meta.label)}</title>
<style>
  body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#F7F5F0;color:#1B1F27;margin:0;padding:32px 20px}
  .wrap{max-width:1080px;margin:0 auto}
  h1{font-size:22px;margin:0 0 4px}
  .sub{color:#5B6472;font-size:14px;margin:0 0 24px}
  .cards{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px}
  .card{background:#fff;border:1px solid #E4DFD4;border-radius:10px;padding:14px 18px;min-width:150px}
  .card b{display:block;font-size:20px}
  .card span{color:#5B6472;font-size:12px;text-transform:uppercase;letter-spacing:.06em}
  table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #E4DFD4;border-radius:10px;overflow:hidden}
  th,td{padding:11px 14px;text-align:left;border-bottom:1px solid #EFEBE2;font-size:14px}
  thead th{background:#F3F0E8;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#5B6472}
  tfoot th{background:#F3F0E8}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  a{color:#8A6719}
  .empty{background:#fff;border:1px dashed #D8D2C4;border-radius:10px;padding:32px;text-align:center;color:#5B6472}
  footer{margin-top:28px;color:#7A8290;font-size:12px}
</style></head>
<body><div class="wrap">
  <h1>Gold Mitra — Records ${esc(meta.label)}</h1>
  <p class="sub">Exported ${esc(meta.generatedAt)} · GSTIN 29BGMPB7189N22ZH</p>
  <div class="cards">
    <div class="card"><b>${apps.length}</b><span>Applications</span></div>
    <div class="card"><b>${esc(receipt.fmtWeight(totalWeight))}</b><span>Gold (g)</span></div>
    <div class="card"><b>₹ ${esc(receipt.fmtMoney(totalAmount))}</b><span>Total amount</span></div>
  </div>
  ${body}
  <footer>Each row links to its full receipt. Open any receipt and press Ctrl+P to save it as a PDF. Full data is also in index.csv.</footer>
</div></body></html>`;
}

/* The print stylesheets, concatenated once and shared by every receipt. */
function bundleCss() {
  const parts = CSS_FILES.map((f) => {
    const p = path.join(CSS_DIR, f);
    try {
      return fs.readFileSync(p, 'utf8');
    } catch (err) {
      return `/* ${f} unavailable */`;
    }
  });
  // Google Fonts cannot be relied on offline; fall back to system faces.
  parts.push(`
@page { size: A4; margin: 12mm; }
body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background:#fff; }
`);
  return parts.join('\n');
}

function receiptPage(bodyHtml, appNo, cssHref) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Receipt ${receipt.esc(appNo)} · Gold Mitra</title>
<link rel="stylesheet" href="${cssHref}" />
<style>
  body { background:#F3F1EC; margin:0; padding:24px 12px; }
  .tip { max-width:840px; margin:0 auto 16px; font:13px/1.5 system-ui,sans-serif; color:#5B6472; text-align:center; }
  .bar { position:sticky; top:0; display:flex; gap:10px; justify-content:center; padding:10px;
         background:rgba(243,241,236,.95); border-bottom:1px solid #E4DFD4; margin:0 -12px 20px; }
  .bar button,.bar a { font:600 13px system-ui,sans-serif; padding:8px 16px; border-radius:8px;
         border:1px solid #C9A227; background:#D4AF37; color:#2A2109; text-decoration:none; cursor:pointer; }
  .bar a { background:#fff; color:#3A3323; }
  @media print { .bar,.tip { display:none !important; } body { padding:0; background:#fff; } }
</style></head>
<body>
  <div class="bar no-print">
    <button onclick="window.print()">Print / Save as PDF</button>
    <a href="../summary.html">Back to summary</a>
  </div>
  <p class="tip no-print">Offline copy of ${receipt.esc(appNo)} · press the button above to print or save as PDF</p>
  <article class="gold-paper-form" style="width:100%;max-width:840px;margin:0 auto;">${bodyHtml}</article>
</body></html>`;
}

/* ------------------------------------------------------------------ route */

router.get('/api/export/records', requireAuth, requireAdmin, async (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database unavailable. Please try again.' });
  }

  const basis = String(req.query.basis || 'day');
  const dateKey = String(req.query.date || '').trim();

  let range;
  let label;
  let stamp;

  if (basis === 'day') {
    const r = istDayRange(dateKey);
    if (!r) {
      return res.status(400).json({ error: 'Please provide a valid date as YYYY-MM-DD.' });
    }
    range = r;
    stamp = dateKey;
    label = `for ${dateKey}`;
  } else if (basis === 'month') {
    const r = istMonthRange(dateKey);
    if (!r) {
      return res.status(400).json({ error: 'Please provide a valid month as YYYY-MM.' });
    }
    range = r;
    stamp = dateKey;
    label = `for ${dateKey}`;
  } else if (basis === 'today') {
    const now = new Date();
    stamp = istDateKey(now);
    range = { start: istDayRange(stamp).start, end: istEndOfDay(now) };
    label = `for today (${stamp})`;
  } else {
    return res.status(400).json({ error: 'Unknown export basis. Use day, month or today.' });
  }

  try {
    const found = await Application.find({
      createdAt: { $gte: range.start, $lt: range.end }
    })
      .sort({ createdAt: 1 })
      .limit(MAX_RECORDS + 1)
      .populate('staff', 'name email')
      .lean();

    const truncated = found.length > MAX_RECORDS;
    const apps = truncated ? found.slice(0, MAX_RECORDS) : found;

    const folderName = `gold-mitra-records-${basis === 'month' ? 'month-' : ''}${stamp}`;
    const fileName = `${folderName}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store');

    const archive = new ZipArchive({ zlib: { level: 6 } });

    archive.on('error', (err) => {
      console.error('Export archive error:', err.message);
      res.destroy(err);
    });

    archive.pipe(res);

    // All entries share this one stylesheet instead of inlining it per receipt.
    archive.append(bundleCss(), { name: `${folderName}/assets/receipt.css` });

    archive.append(
      buildCsv(apps),
      { name: `${folderName}/index.csv` }
    );

    const meta = {
      basis,
      label,
      generatedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    };
    archive.append(buildSummaryHtml(apps, meta), { name: `${folderName}/summary.html` });

    if (truncated) {
      archive.append(
        `Only the first ${MAX_RECORDS} applications were included. Narrow the date range and export again.`,
        { name: `${folderName}/TRUNCATED.txt` }
      );
    }

    apps.forEach((app) => {
      const { files, bySlot } = planImages(app);
      files.forEach((f) => {
        archive.append(f.buffer, { name: `${folderName}/assets/${f.name}` });
      });

      const body = receipt.render(app, {
        imageSrc: (dataUrl, slot) => bySlot[slot] || dataUrl,
        signatures: {
          show: true,
          staff: bySlot['staff-signature'] || '',
          customer: bySlot['customer-signature'] || ''
        }
      });

      archive.append(receiptPage(body, app.applicationNo, '../assets/receipt.css'), {
        name: `${folderName}/receipts/${safeName(app.applicationNo)}.html`
      });
    });

    await archive.finalize();

    console.log(
      `Export ${basis} ${label}: ${apps.length} record(s)${truncated ? ' (truncated)' : ''}`
    );
  } catch (err) {
    console.error('Export error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Could not build the export. Please try again.' });
    } else {
      res.destroy(err);
    }
  }
});

module.exports = router;
