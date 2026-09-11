/* ============================================
   Gold Mitra — A4 loan application renderer
   Standalone page: fetches the record via API
   and renders the professional paper document.
   Supports English and ಕನ್ನಡ (Kannada).
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

  /* ---------- Bilingual text ---------- */

  const LANG = {
    en: {
      kicker: 'Loan Application · Hard Copy',
      title: 'GOLD LOAN APPLICATION',
      metaLoanNo: 'Loan number',
      metaAppDate: 'Application date',
      metaLoanDate: 'Loan date',
      metaPayMode: 'Payment mode',
      metaStatus: 'Status',
      metaPrepared: 'Prepared by',
      payCash: 'Cash',
      payAccount: 'Bank transfer',
      secCustomer: 'Customer / Applicant details',
      fName: 'Full name',
      fMobile: 'Mobile number',
      fAadhaar: 'Aadhaar number',
      fAddress: 'Address',
      secItems: 'Gold / Jewellery particulars',
      thPhoto: 'Photo',
      thItem: 'Item &amp; description',
      thPurity: 'Purity',
      thWeight: 'Weight',
      totalLabel: 'Total',
      itemSingular: 'item',
      itemPlural: 'items',
      secLoan: 'Loan / Amount details',
      lAmount: 'Loan amount',
      lMode: 'Payment mode',
      lDate: 'Loan date',
      wordsLabel: 'Amount in words',
      acctHolder: 'Account holder',
      acctNumber: 'Account number',
      acctIfsc: 'IFSC',
      secTerms: 'Important terms &amp; conditions',
      secDecl: 'Declaration &amp; signatures',
      declaration: (d) =>
        `<strong>Declaration.</strong> I, <strong>${d.name}</strong>, hereby declare that the jewellery ` +
        `described above (total <strong>${d.weight}</strong>) is legally and exclusively owned by me and is ` +
        `free from all encumbrances. I have handed over the said jewellery to Gold Mitra as security against ` +
        `a gold loan of <strong>${d.amount}</strong> (${d.words}) disbursed in <strong>${d.mode}</strong>. ` +
        `I confirm that the information furnished in this application is true and correct and I agree to the ` +
        `terms and conditions printed above.`,
      placeLabel: 'Place',
      dateLabel: 'Date',
      sigCustomerTitle: 'Customer / Pledger',
      sigCustomerRole: 'Signature / thumb impression',
      sigOfficerTitle: 'Prepared by · Field Officer',
      sigAuthTitle: 'Authorized Signatory',
      sigAuthRole: 'Branch authority · Gold Mitra',
      sigLine: 'Signature',
      sigStamp: 'Official stamp',
      terms: [
        'The gold jewellery pledged herein is subject to independent verification of purity, weight and valuation by Gold Mitra. Loan eligibility, margin and interest rate shall be decided by Gold Mitra in accordance with its lending policy.',
        'The pledged gold remains the property of the customer and is held by Gold Mitra as security under a first and continuing pledge until the loan together with interest and all charges is fully repaid.',
        'Interest accrues from the date of disbursal. Repayments are due in accordance with the schedule agreed at the time of sanction. Delay or default attracts penal interest and recovery action as per policy.',
        'The customer shall preserve this application and its acknowledgement. Redemption shall be made, as per Gold Mitra policy, against full settlement of dues and surrender of all documents and jewellery receipts.',
        'KYC documents submitted with this application shall be verified. Any false, forged or misleading information shall render the loan void and may attract legal action.',
        'Gold Mitra may value, insure and, if required, realize the pledged gold should the customer fail to redeem within the applicable period. Any surplus or deficit shall be dealt with as per applicable law.',
        'This application is subject to applicable laws and regulations. Any dispute arising thereunder shall be subject to the jurisdiction of the competent courts locally.',
        'Force majeure, regulatory or policy changes may affect the terms herein, and such changes shall be binding once intimated in writing.'
      ]
    },

    kn: {
      kicker: 'ಸಾಲದ ಅರ್ಜಿ · ಹಾರ್ಡ್ ಕಾಪಿ',
      title: 'ಚಿನ್ನದ ಸಾಲದ ಅರ್ಜಿ',
      metaLoanNo: 'ಸಾಲ ಸಂಖ್ಯೆ',
      metaAppDate: 'ಅರ್ಜಿ ದಿನಾಂಕ',
      metaLoanDate: 'ಸಾಲ ದಿನಾಂಕ',
      metaPayMode: 'ಪಾವತಿ ವಿಧಾನ',
      metaStatus: 'ಸ್ಥಿತಿ',
      metaPrepared: 'ಸಿದ್ಧಪಡಿಸಿದವರು',
      payCash: 'ನಗದು',
      payAccount: 'ಬ್ಯಾಂಕ್ ವರ್ಗಾವಣೆ',
      secCustomer: 'ಗ್ರಾಹಕ / ಅರ್ಜಿದಾರರ ವಿವರಗಳು',
      fName: 'ಪೂರ್ಣ ಹೆಸರು',
      fMobile: 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ',
      fAadhaar: 'ಆಧಾರ್ ಸಂಖ್ಯೆ',
      fAddress: 'ವಿಳಾಸ',
      secItems: 'ಚಿನ್ನ / ಆಭರಣಗಳ ವಿವರ',
      thPhoto: 'ಫೋಟೋ',
      thItem: 'ಸಾಮಾನು &amp; ವಿವರ',
      thPurity: 'ಪ್ಯೂರಿಟಿ',
      thWeight: 'ತೂಕ',
      totalLabel: 'ಒಟ್ಟು',
      itemSingular: 'ವಸ್ತು',
      itemPlural: 'ವಸ್ತುಗಳು',
      secLoan: 'ಸಾಲ / ಮೊತ್ತದ ವಿವರ',
      lAmount: 'ಸಾಲದ ಮೊತ್ತ',
      lMode: 'ಪಾವತಿ ವಿಧಾನ',
      lDate: 'ಸಾಲ ದಿನಾಂಕ',
      wordsLabel: 'ಮೊತ್ತವನ್ನು ಪದಗಳಲ್ಲಿ',
      acctHolder: 'ಖಾತೆದಾರರ ಹೆಸರು',
      acctNumber: 'ಖಾತೆ ಸಂಖ್ಯೆ',
      acctIfsc: 'ಐಎಫ್ಎಸ್ಸಿ',
      secTerms: 'ಪ್ರಮುಖ ನಿಯಮಗಳು ಮತ್ತು ಷರತ್ತುಗಳು',
      secDecl: 'ಘೋಷಣೆ ಮತ್ತು ಸಹಿಗಳು',
      declaration: (d) =>
        `<strong>ಘೋಷಣೆ.</strong> ನಾನು, <strong>${d.name}</strong>, ಕೆಳಗೆ ವಿವರಿಸಲಾದ ಚಿನ್ನಾಭರಣಗಳು ` +
        `(ಒಟ್ಟು <strong>${d.weight}</strong>) ಕಾನೂನುಬದ್ಧವಾಗಿ ನನ್ನ ಸ್ವಂತ ಮತ್ತು ಏಕಮಾತ್ರ ಆಸ್ತಿಯಾಗಿದ್ದು, ` +
        `ಯಾವುದೇ ಹೊರೆಯಿಂದ (ಇತರರ ಹಕ್ಕು) ಮುಕ್ತವಾಗಿವೆ ಎಂದು ಘೋಷಿಸುತ್ತೇನೆ. ${d.amount} (${d.words}) ಮೊತ್ತದ ` +
        `ಸಾಲಕ್ಕೆ ವಿರುದ್ಧವಾಗಿ ಭದ್ರತೆಯಾಗಿ ಗೋಲ್ಡ್ ಮಿತ್ರಗೆ ಒತ್ತೆಯಲ್ಲಿ ನೀಡಿದ್ದೇನೆ; ಈ ಮೊತ್ತವನ್ನು ` +
        `<strong>${d.mode}</strong> ಮೂಲಕ ವಿತರಿಸಲಾಗಿದೆ. ಈ ಅರ್ಜಿಯಲ್ಲಿ ನೀಡಿರುವ ಮಾಹಿತಿಯು ನಿಜವಾದದ್ದು ಮತ್ತು ` +
        `ಸರಿಯಾದದ್ದು ಎಂದು ದೃಢೀಕರಿಸುತ್ತೇನೆ, ಹಾಗೂ ಮೇಲೆ ಮುದ್ರಿಸಲಾದ ನಿಯಮಗಳು ಮತ್ತು ಷರತ್ತುಗಳಿಗೆ ಸಮ್ಮತಿಸುತ್ತೇನೆ.`,
      placeLabel: 'ಸ್ಥಳ',
      dateLabel: 'ದಿನಾಂಕ',
      sigCustomerTitle: 'ಗ್ರಾಹಕ / ಒತ್ತೆದಾರ',
      sigCustomerRole: 'ಸಹಿ / ಹೆಬ್ಬೆರಳು ಗುರುತು',
      sigOfficerTitle: 'ಸಿದ್ಧಪಡಿಸಿದವರು · ಫೀಲ್ಡ್ ಅಧಿಕಾರಿ',
      sigAuthTitle: 'ಅಧಿಕೃತ ಸಹಿದಾರ',
      sigAuthRole: 'ಶಾಖಾ ಅಧಿಕಾರಿ · ಗೋಲ್ಡ್ ಮಿತ್ರ',
      sigLine: 'ಸಹಿ',
      sigStamp: 'ಅಧಿಕೃತ ಮುದ್ರೆ',
      terms: [
        'ಈ ಅರ್ಜಿಯಲ್ಲಿ ಒತ್ತೆ ಇಟ್ಟ ಚಿನ್ನಾಭರಣಗಳ ತೂಕ, ಪ್ಯೂರಿಟಿ (ಪರಿಶುದ್ಧತೆ) ಮತ್ತು ಬೆಲೆಯನ್ನು ಗೋಲ್ಡ್ ಮಿತ್ರ ತನ್ನ ಲೆಕ್ಕಪರಿಶೋಧನೆಗೆ ಒಳಪಟ್ಟಿರುತ್ತದೆ. ಸಾಲದ ಅರ್ಹತೆ, ಎರವಲು ಅಂಚು (ಮಾರ್ಜಿನ್) ಮತ್ತು ಬಡ್ಡಿ ದರವನ್ನು ಗೋಲ್ಡ್ ಮಿತ್ರ ತನ್ನ ಸಾಲ ನೀತಿಯ ಪ್ರಕಾರ ನಿರ್ಧರಿಸುತ್ತದೆ.',
        'ಒತ್ತೆ ಇಟ್ಟ ಚಿನ್ನವು ಗ್ರಾಹಕರ ಆಸ್ತಿಯಾಗಿಯೇ ಉಳಿಯುತ್ತದೆ ಮತ್ತು, ಸಾಲ, ಬಡ್ಡಿ ಮತ್ತು ಎಲ್ಲಾ ಶುಲ್ಕಗಳು ಸಂಪೂರ್ಣವಾಗಿ ಮರುಪಾವತಿಯಾಗುವವರೆಗೆ, ಅದನ್ನು ಗೋಲ್ಡ್ ಮಿತ್ರ ಪ್ರಥಮ ಮತ್ತು ನಿರಂತರ ಒತ್ತೆಯ (ಪ್ಲೆಡ್ಜ್) ರೂಪದಲ್ಲಿ ಹೊಂದಿರುತ್ತದೆ.',
        'ಬಡ್ಡಿಯು ಸಾಲ ವಿತರಣೆಯ ದಿನದಿಂದ ಆರಂಭವಾಗುತ್ತದೆ. ಮರುಪಾವತಿಯನ್ನು ಮಂಜೂರಾತಿ ಸಮಯದಲ್ಲಿ ಒಪ್ಪಿದ ಕ್ರಮವನ್ನು ಅನುಸರಿಸಿ ಮಾಡಬೇಕು. ವಿಳಂಬ ಅಥವಾ ಬಾಕಿ ಉಳಿಸಿದಲ್ಲಿ, ಕಂಪನಿಯ ನೀತಿಯ ಪ್ರಕಾರ ದಂಡದ ಬಡ್ಡಿ ಮತ್ತು ವಸೂಲಿ ಕ್ರಮ ಅನ್ವಯಿಸುತ್ತದೆ.',
        'ಗ್ರಾಹಕರು ಈ ಅರ್ಜಿಯನ್ನು ಮತ್ತು ಅದರ ಸ್ವೀಕೃತಿಯನ್ನು ಸುರಕ್ಷಿತವಾಗಿ ಇಟ್ಟುಕೊಳ್ಳಬೇಕು. ಎಲ್ಲಾ ಬಾಕಿಗಳು ಪೂರ್ಣವಾಗಿ ತೀರಿದ ನಂತರ, ಎಲ್ಲಾ ದಾಖಲೆಗಳು ಮತ್ತು ಚಿನ್ನದ ರಶೀದಿಗಳನ್ನು ಹಿಂದಿರುಗಿಸಿದಾಗ, ಗೋಲ್ಡ್ ಮಿತ್ರದ ನೀತಿಯ ಪ್ರಕಾರ ಒತ್ತೆಯ ಚಿನ್ನವನ್ನು ಹಿಂದಿರುಗಿಸಲಾಗುತ್ತದೆ.',
        'ಈ ಅರ್ಜಿಯೊಂದಿಗೆ ಸಲ್ಲಿಸಿದ KYC ದಾಖಲೆಗಳನ್ನು ಪರಿಶೀಲಿಸಲಾಗುತ್ತದೆ. ಯಾವುದೇ ಸುಳ್ಳು, ನಕಲಿ ಅಥವಾ ತಪ್ಪುದಾರಿಗೆಳೆಯುವ ಮಾಹಿತಿಯು ಸಾಲವನ್ನು ಅನೂರ್ಜಿತಗೊಳಿಸುತ್ತದೆ ಮತ್ತು ಕಾನೂನು ಕ್ರಮಕ್ಕೆ ಗುರಿಯಾಗಬಹುದು.',
        'ನಿಗದಿತ ಅವಧಿಯೊಳಗೆ ಗ್ರಾಹಕರು ಚಿನ್ನವನ್ನು ಹಿಂದಕ್ಕೆ ಪಡೆಯದಿದ್ದರೆ, ಗೋಲ್ಡ್ ಮಿತ್ರ ಒತ್ತೆಯ ಚಿನ್ನವನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡಿ, ವಿಮೆ ಮಾಡಿಸಬಹುದು ಮತ್ತು ಅಗತ್ಯವಿದ್ದಲ್ಲಿ ಮಾರಾಟ ಮಾಡಬಹುದು. ಹೆಚ್ಚುವರಿ ಅಥವಾ ಕಡಿಮೆಯ ಮೊತ್ತವನ್ನು ಅನ್ವಯವಾಗುವ ಕಾನೂನಿನ ಪ್ರಕಾರ ನಿರ್ವಹಿಸಲಾಗುತ್ತದೆ.',
        'ಈ ಅರ್ಜಿಯು ಅನ್ವಯವಾಗುವ ಕಾನೂನುಗಳು ಮತ್ತು ನಿಯಮಗಳಿಗೆ ಒಳಪಟ್ಟಿರುತ್ತದೆ. ಇದರಿಂದಾಗುವ ಯಾವುದೇ ವಿವಾದಕ್ಕೆ ಸ್ಥಳೀಯ ಸಮರ್ಥ ನ್ಯಾಯಾಲಯದ ಅಧಿಕಾರ ವ್ಯಾಪ್ತಿ ಅನ್ವಯವಾಗುತ್ತದೆ.',
        'ಅನಿವಾರ್ಯ ಸಂದರ್ಭಗಳು (ಫೋರ್ಸ್ ಮೇಜರ್), ನಿಯಂತ್ರಕ ಅಥವಾ ನೀತಿ ಬದಲಾವಣೆಗಳಿಂದ ಈ ಷರತ್ತುಗಳ ಮೇಲೆ ಪರಿಣಾಮ ಬೀರಬಹುದು. ಅಂತಹ ಬದಲಾವಣೆಗಳನ್ನು ಲಿಖಿತವಾಗಿ ಸೂಚಿಸಿದ ಬಳಿಕ ಅವು ಬದ್ಧವಾಗಿರುತ್ತವೆ.'
      ]
    }
  };

  let currentLang = 'en';
  let cached = null;

  try {
    currentLang = localStorage.getItem('gm_print_lang') === 'kn' ? 'kn' : 'en';
  } catch (e) {
    currentLang = 'en';
  }

  /* ---------- Sections ---------- */

  function jewelleryRows(items, L) {
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

  function termsHTML(L) {
    return L.terms.map(
      (t, i) => `<div class="pd-term"><span class="pd-term__num">${i + 1}.</span><span class="pd-term__text">${esc(t)}</span></div>`
    ).join('');
  }

  function draw(a, user) {
    const n = a.jewelleryItems.length;
    const status = STATUS[a.status] || STATUS.pending;
    const L = LANG[currentLang];
    const isAccount = a.loan.paymentMode === 'account' && (a.loan.accountDetails || {}).holderName;
    const place = esc(a.customer.address.split(',').pop().trim() || '—');
    const modeText = a.loan.paymentMode === 'cash' ? L.payCash : L.payAccount;

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
          <div class="pd-kicker">${esc(L.kicker)}</div>
          <div class="pd-title">${esc(L.title)}</div>
          <span class="pd-no">${esc(a.applicationNo)}</span>
        </div>
      </header>

      <div class="pd-rule"></div>

      <!-- ============ Meta ============ -->
      <div class="pd-meta">
        <span class="pd-meta__item">
          <span class="pd-meta__label">${esc(L.metaLoanNo)}</span>
          <span class="pd-meta__value">${esc(a.applicationNo)}</span>
        </span>
        <span class="pd-meta__item">
          <span class="pd-meta__label">${esc(L.metaAppDate)}</span>
          <span class="pd-meta__value">${esc(formatDate(a.createdAt))}</span>
        </span>
        <span class="pd-meta__item">
          <span class="pd-meta__label">${esc(L.metaLoanDate)}</span>
          <span class="pd-meta__value">${esc(formatDate(a.loan.date))}</span>
        </span>
        <span class="pd-meta__item">
          <span class="pd-meta__label">${esc(L.metaPayMode)}</span>
          <span class="pd-meta__value">${esc(modeText)}</span>
        </span>
        <span class="pd-meta__item">
          <span class="pd-meta__label">${esc(L.metaStatus)}</span>
          <span class="pd-status ${status.cls}"><span class="pd-status__dot"></span>${esc(status.label)}</span>
        </span>
        <span class="pd-meta__item pd-meta__item--push">
          <span class="pd-meta__label">${esc(L.metaPrepared)}</span>
          <span class="pd-meta__value">${esc(a.staff ? a.staff.name : '—')}</span>
        </span>
      </div>

      <!-- ============ 1. Customer ============ -->
      <section class="pd-section">
        <h2 class="pd-section__title"><span class="pd-section__num">1</span>${esc(L.secCustomer)}</h2>
        <div class="pd-customer">
          ${
            a.customer.photoData
              ? `<img class="pd-customer__photo" src="${a.customer.photoData}" alt="Customer photo" />`
              : `<div class="pd-customer__photo pd-customer__photo--empty">◉</div>`
          }
          <div class="pd-customer__fields">
            <div class="pd-field">
              <div class="pd-field__label">${esc(L.fName)}</div>
              <div class="pd-field__value">${esc(a.customer.name)}</div>
            </div>
            <div class="pd-field">
              <div class="pd-field__grid">
                <div>
                  <div class="pd-field__label">${esc(L.fMobile)}</div>
                  <div class="pd-field__value">${esc(a.customer.mobile)}</div>
                </div>
                <div>
                  <div class="pd-field__label">${esc(L.fAadhaar)}</div>
                  <div class="pd-field__value">${esc(formatAadhaar(a.customer.aadhaar))}</div>
                </div>
              </div>
            </div>
            <div class="pd-field">
              <div class="pd-field__label">${esc(L.fAddress)}</div>
              <div class="pd-field__value">${esc(a.customer.address || '—')}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- ============ 2. Jewellery ============ -->
      <section class="pd-section">
        <h2 class="pd-section__title"><span class="pd-section__num">2</span>${esc(L.secItems)}</h2>
        <table class="pd-table">
          <thead>
            <tr>
              <th>#</th>
              <th>${esc(L.thPhoto)}</th>
              <th>${L.thItem}</th>
              <th>${esc(L.thPurity)}</th>
              <th style="text-align:right">${esc(L.thWeight)}</th>
            </tr>
          </thead>
          <tbody>
            ${jewelleryRows(a.jewelleryItems, L)}
            <tr class="pd-row-total">
              <td colspan="2"></td>
              <td style="text-transform:uppercase;letter-spacing:0.04em">
                ${esc(L.totalLabel)} — ${n} ${n === 1 ? esc(L.itemSingular) : esc(L.itemPlural)}
              </td>
              <td></td>
              <td class="pd-table__cell-weight">${formatWeight(a.totalWeightGrams)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- ============ 3. Loan ============ -->
      <section class="pd-section">
        <h2 class="pd-section__title"><span class="pd-section__num">3</span>${esc(L.secLoan)}</h2>
        <div class="pd-loan">
          <div class="pd-loan__box pd-loan__box--amount">
            <div class="pd-loan__label">${esc(L.lAmount)}</div>
            <div class="pd-loan__value">${formatINR(a.loan.amount)}</div>
          </div>
          <div class="pd-loan__box">
            <div class="pd-loan__label">${esc(L.lMode)}</div>
            <div class="pd-loan__value pd-loan__value--small">${esc(modeText)}</div>
          </div>
          <div class="pd-loan__box">
            <div class="pd-loan__label">${esc(L.lDate)}</div>
            <div class="pd-loan__value pd-loan__value--small">${esc(formatDate(a.loan.date))}</div>
          </div>
        </div>
        <div class="pd-amount-words">
          <span class="pd-amount-words__label">${esc(L.wordsLabel)}</span>
          <span class="pd-amount-words__value">${esc(amountInWords(a.loan.amount))}</span>
        </div>
        ${isAccount ? `
          <div class="pd-account">
            <div class="pd-account__row"><span class="pd-account__label">${esc(L.acctHolder)}</span><span class="pd-account__value">${esc(a.loan.accountDetails.holderName)}</span></div>
            <div class="pd-account__row"><span class="pd-account__label">${esc(L.acctNumber)}</span><span class="pd-account__value">${esc(a.loan.accountDetails.accountNumber || '—')}</span></div>
            <div class="pd-account__row"><span class="pd-account__label">${esc(L.acctIfsc)}</span><span class="pd-account__value">${esc(a.loan.accountDetails.ifsc || '—')}</span></div>
          </div>` : ''}
      </section>

      <!-- ============ 4. Terms ============ -->
      <section class="pd-section">
        <h2 class="pd-section__title"><span class="pd-section__num">4</span>${L.secTerms}</h2>
        <div class="pd-terms">${termsHTML(L)}</div>
      </section>

      <!-- ============ 5. Declaration ============ -->
      <section class="pd-section">
        <h2 class="pd-section__title"><span class="pd-section__num">5</span>${esc(L.secDecl)}</h2>

        <div class="pd-declaration">
          ${L.declaration({
            name: esc(a.customer.name),
            weight: esc(formatWeight(a.totalWeightGrams)),
            amount: esc(formatINR(a.loan.amount)),
            words: esc(amountInWords(a.loan.amount)),
            mode: esc(modeText)
          })}
        </div>

        <div class="pd-place-date">
          <span class="pd-place-date__item"><span class="pd-field__label">${esc(L.placeLabel)}</span><span>${place}</span></span>
          <span class="pd-place-date__item"><span class="pd-field__label">${esc(L.dateLabel)}</span><span>${esc(formatDate(a.loan.date))}</span></span>
        </div>

        <div class="pd-sig-grid">
          <div class="pd-sig">
            <div class="pd-sig__title">${esc(L.sigCustomerTitle)}</div>
            <div class="pd-sig__name">${esc(a.customer.name)}</div>
            <div class="pd-sig__role">${esc(L.sigCustomerRole)}</div>
            <div class="pd-sig__line">${esc(L.sigLine)}</div>
          </div>
          <div class="pd-sig">
            <div class="pd-sig__title">${esc(L.sigOfficerTitle)}</div>
            <div class="pd-sig__name">${esc(a.staff ? a.staff.name : '—')}</div>
            <div class="pd-sig__role">${esc(a.staff && a.staff.role ? a.staff.role.replace('-', ' ') : '')}</div>
            <div class="pd-sig__line">${esc(L.sigLine)}</div>
          </div>
          <div class="pd-sig">
            <div class="pd-sig__title">${esc(L.sigAuthTitle)}</div>
            <div class="pd-sig__name">&nbsp;</div>
            <div class="pd-sig__role">${esc(L.sigAuthRole)}</div>
            <div class="pd-sig__line">${esc(L.sigLine)}</div>
            <div class="pd-sig__stamp">${esc(L.sigStamp)}</div>
          </div>
        </div>
      </section>

      <!-- ============ Footer ============ -->
      <footer class="pd-footer">
        <div class="pd-footer__note">
          <span>This is a computer-generated document from Gold Mitra.</span>
          <span>Printed by ${esc(user)} · ${esc(formatDateTime(new Date()))}</span>
        </div>
        <div class="pd-footer__terms">
          Gold jewellery pledged as security is subject to verification of purity and weight. Valuation,
          interest rate and loan eligibility are determined by Gold Mitra in accordance with its lending
          policy. This document does not by itself authorize release or redemption of jewellery.
        </div>
      </footer>`;
  }

  function applyLangButtons() {
    document.querySelectorAll('.lang-btn').forEach((btn) => {
      const active = btn.dataset.lang === currentLang;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function setLang(lng) {
    if (lng !== 'en' && lng !== 'kn') lng = 'en';
    currentLang = lng;
    try {
      localStorage.setItem('gm_print_lang', lng);
    } catch (e) { /* ignore */ }
    applyLangButtons();
    if (cached) draw(cached, cached._user);
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
      cached = data.application;
      cached._user = me.user.name || '—';
      draw(cached, cached._user);
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

    document.querySelectorAll('.lang-btn').forEach((btn) => {
      btn.addEventListener('click', () => setLang(btn.dataset.lang));
    });

    $('#printBtn').addEventListener('click', () => window.print());

    $('#backBtn').addEventListener('click', (e) => {
      e.preventDefault();
      if (recordId) location.href = `/records/${recordId}`;
      else location.href = '/records';
    });
  });
})();