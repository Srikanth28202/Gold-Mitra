/*
 * End-to-end test for the records ZIP export.
 * Verifies the bundle opens, is self-contained, and that the admin-only
 * boundary actually holds.
 * Usage: node test/export-test.js   (needs the server running on PORT)
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE = `http://localhost:${process.env.PORT || 3000}`;
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@goldmitra.com').toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';

const PASS = [];
const FAIL = [];
const pass = (n) => { PASS.push(n); console.log('PASS', n); };
const fail = (n, m) => { FAIL.push(n); console.log('FAIL', n, m ?? ''); };

const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const TMP = path.join(process.env.TEMP || '.', 'gm-export-test');

/* Two independent cookie jars, the way two different browsers behave.
   Keeping them apart is what lets us prove the officer is refused while the
   admin is still allowed in the same run. */
const admin = { cookie: '' };
const officer = { cookie: '' };

async function call(p, { method = 'GET', body, raw = false, jar = admin } = {}) {
  const res = await fetch(BASE + p, {
    method,
    headers: { 'content-type': 'application/json', cookie: jar.cookie },
    body: body ? JSON.stringify(body) : undefined
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) jar.cookie = setCookie.split(';')[0];
  if (raw) return { res, buf: Buffer.from(await res.arrayBuffer()) };
  let data = null;
  try { data = await res.json(); } catch (_) {}
  return { res, data, status: res.status };
}

/* Minimal ZIP central-directory reader, so the test needs no unzip library. */
function listZipEntries(buf) {
  const entries = [];
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    entries.push(buf.slice(off + 46, off + 46 + nameLen).toString('utf8'));
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

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

async function main() {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });

  const health = await call('/api/health');
  if (health.status !== 200) {
    console.error('✗ Server not responding on ' + BASE + ' — start it with `npm start` first');
    process.exit(1);
  }

  const login = await call('/api/auth/login', { method: 'POST', body: { email: adminEmail, password: adminPassword } });
  if (login.status !== 200) return console.error('✗ Login failed'), process.exit(1);
  pass('1.01 Admin login for export test');

  /* A login must hand out a NEW session id, otherwise a planted cookie keeps
     working after the victim authenticates (session fixation). */
  const planted = admin.cookie;
  await call('/api/auth/login', { method: 'POST', body: { email: adminEmail, password: adminPassword } });
  if (admin.cookie && admin.cookie !== planted) pass('1.02 Login issues a fresh session id');
  else fail('1.02 Login issues a fresh session id', 'cookie unchanged');

  /* --- access control --- */
  const anon = { cookie: '' };
  const anonRes = await call('/api/export/records?basis=today', { jar: anon });
  if (anonRes.status === 401) pass('1.03 Anonymous export rejected (401)');
  else fail('1.03 Anonymous export rejected (401)', 'got ' + anonRes.status);

  /* --- input validation --- */
  const badDay = await call('/api/export/records?basis=day&date=2026-02-30');
  if (badDay.status === 400) pass('1.04 Impossible date rejected (400)');
  else fail('1.04 Impossible date rejected (400)', 'got ' + badDay.status);

  const badBasis = await call('/api/export/records?basis=decade');
  if (badBasis.status === 400) pass('1.05 Unknown basis rejected (400)');
  else fail('1.05 Unknown basis rejected (400)', 'got ' + badBasis.status);

  const noDate = await call('/api/export/records?basis=day');
  if (noDate.status === 400) pass('1.06 Missing date rejected (400)');
  else fail('1.06 Missing date rejected (400)', 'got ' + noDate.status);

  /* --- a field officer must be refused, and the admin must keep working --- */
  const officerEmail = `export-test-${Date.now()}@goldmitra.com`;
  const officerPass = 'ExportTest@12345';
  const madeStaff = await call('/api/staff', {
    method: 'POST',
    body: { name: 'Export Test Officer', email: officerEmail, phone: '9000000009', password: officerPass, role: 'field-officer' }
  });

  let officerId = null;
  if (madeStaff.status === 201 && madeStaff.data && madeStaff.data.member) {
    officerId = madeStaff.data.member._id || madeStaff.data.member.id;

    const oLogin = await call('/api/auth/login', {
      method: 'POST', jar: officer, body: { email: officerEmail, password: officerPass }
    });
    if (oLogin.status !== 200) {
      fail('1.07 Field officer export forbidden (403)', 'officer login failed ' + oLogin.status);
    } else {
      const denied = await call('/api/export/records?basis=today', { jar: officer, raw: true });
      if (denied.res.status === 403) pass('1.07 Field officer export forbidden (403)');
      else fail('1.07 Field officer export forbidden (403)', 'got ' + denied.res.status);

      // The officer must not be able to reach the other date bases either.
      for (const q of ['basis=day&date=' + istToday(), 'basis=month&date=' + istMonth()]) {
        const qd = await call('/api/export/records?' + q, { jar: officer, raw: true });
        if (qd.res.status === 403) pass('1.08 Officer refused for ' + q.split('=')[0]);
        else fail('1.08 Officer refused for ' + q.split('=')[0], 'got ' + qd.res.status);
      }
    }

    // And the admin session must be untouched by the officer's login.
    const stillAdmin = await call('/api/export/records?basis=today', { raw: true });
    if (stillAdmin.res.status === 200) pass('1.09 Admin session survives a second login');
    else fail('1.09 Admin session survives a second login', 'got ' + stillAdmin.res.status);

    if (officerId) {
      const off = await call(`/api/staff/${officerId}/active`, { method: 'PATCH' });
      if (off.status === 200 && off.data && off.data.member && off.data.member.isActive === false) {
        pass('1.10 Export test officer deactivated');
      } else {
        fail('1.10 Export test officer deactivated', 'status ' + off.status);
      }
    }
  } else {
    console.log('SKIP  field-officer checks (staff create returned ' + madeStaff.status + ')');
  }

  /* --- fixtures with distinct image formats --- */
  const made = [];
  for (let i = 1; i <= 2; i++) {
    const r = await call('/api/applications', {
      method: 'POST',
      body: {
        customer: {
          name: `Export Fixture ${i}`, mobile: `98765432${i}0`, aadhaar: `12345678901${i}`,
          address: 'Export Fixture Lane, Tumkur', fatherName: 'F', motherName: 'M',
          spouseName: 'S', profession: 'Farmer', photoData: JPG
        },
        jewelleryItems: [
          { itemName: 'Bangle', purity: '22K / 916', weightGrams: 20 + i, description: 'x', photoData: PNG },
          { itemName: 'Chain', purity: '18K / 750', weightGrams: 5.5, description: 'y', photoData: PNG }
        ],
        staffSignature: JPG,
        customerSignature: JPG,
        loan: { amount: 90000 + i, paymentMode: 'cash', date: new Date().toISOString() }
      }
    });
    if (r.status === 201 && r.data.application) made.push(r.data.application.id || r.data.application._id);
  }
  if (made.length === 2) pass('2.01 Export fixtures created (2)');
  else fail('2.01 Export fixtures created (2)', made.length + ' created');
  if (!made.length) return finish();

  /* --- day export --- */
  const day = await call(`/api/export/records?basis=day&date=${istToday()}`, { raw: true });
  fs.writeFileSync(path.join(TMP, 'day.zip'), day.buf);

  if (day.res.status === 200) pass('3.01 Day export served (200)');
  else fail('3.01 Day export served (200)', 'got ' + day.res.status);

  const cd = day.res.headers.get('content-disposition') || '';
  if (cd.includes('attachment') && cd.includes('.zip')) pass('3.02 Served as a .zip attachment');
  else fail('3.02 Served as a .zip attachment', cd);

  if (day.buf.slice(0, 2).toString() === 'PK') pass('3.03 Valid ZIP signature');
  else fail('3.03 Valid ZIP signature', day.buf.slice(0, 2).toString('hex'));

  const entries = listZipEntries(day.buf) || [];
  if (entries.length) pass('3.04 ZIP central directory readable (' + entries.length + ' entries)');
  else fail('3.04 ZIP central directory readable', 'no entries');

  const folder = entries.length ? entries[0].split('/')[0] : '';
  const has = (suffix) => entries.some((e) => e === folder + suffix);
  const hasAny = (re) => entries.some((e) => re.test(e));

  if (has('/index.csv')) pass('3.05 Bundle contains index.csv');
  else fail('3.05 Bundle contains index.csv', entries.join(', '));

  if (has('/summary.html')) pass('3.06 Bundle contains summary.html');
  else fail('3.06 Bundle contains summary.html', '');

  if (has('/assets/receipt.css')) pass('3.07 Shared stylesheet written once');
  else fail('3.07 Shared stylesheet written once', '');

  if (hasAny(/^\S+\/receipts\/GL-.*\.html$/)) pass('3.08 A receipt per record');
  else fail('3.08 A receipt per record', '');

  if (hasAny(/^\S+\/assets\/.*-customer\.jpg$/)) pass('3.09 Customer photo saved as a file');
  else fail('3.09 Customer photo saved as a file', entries.join(', '));

  if (hasAny(/^\S+\/assets\/.*-gold\.png$/)) pass('3.10 Gold photo saved as a file');
  else fail('3.10 Gold photo saved as a file', entries.join(', '));

  if (has('/TRUNCATED.txt') === false) pass('3.11 No truncation notice for a small export');
  else fail('3.11 No truncation notice for a small export', 'unexpected TRUNCATED.txt');

  /* --- month export --- */
  const month = await call(`/api/export/records?basis=month&date=${istMonth()}`, { raw: true });
  fs.writeFileSync(path.join(TMP, 'month.zip'), month.buf);
  if (month.res.status === 200 && month.buf.slice(0, 2).toString() === 'PK') pass('3.12 Month export served as a valid ZIP');
  else fail('3.12 Month export served as a valid ZIP', 'got ' + month.res.status);

  const monthEntries = listZipEntries(month.buf) || [];
  if (monthEntries.length >= entries.length) pass('3.13 Month bundle covers at least the day bundle (' + monthEntries.length + ' vs ' + entries.length + ')');
  else fail('3.13 Month bundle covers at least the day bundle', monthEntries.length + ' < ' + entries.length);

  /* --- empty period still produces a valid bundle --- */
  const empty = await call('/api/export/records?basis=day&date=2001-01-01', { raw: true });
  const emptyEntries = listZipEntries(empty.buf) || [];
  if (empty.res.status === 200 && emptyEntries.some((e) => e.endsWith('/summary.html'))) {
    pass('3.14 Empty period still returns a usable bundle');
  } else {
    fail('3.14 Empty period still returns a usable bundle', 'status ' + empty.res.status);
  }

  /* --- cleanup --- */
  for (const id of made) await call(`/api/applications/${id}`, { method: 'DELETE' });
  const after = await call('/api/applications');
  if (after.data && after.data.total === 0) pass('4.01 Export fixtures cleaned up');
  else fail('4.01 Export fixtures cleaned up', (after.data && after.data.total) + ' left behind');

  // There is no staff DELETE endpoint, so the throwaway officer is removed
  // straight from the collection - otherwise every run leaves a dead account.
  if (officerId) {
    try {
      const { connectDB, disconnectDB } = require('../src/config/db');
      const Staff = require('../src/models/Staff');
      if (await connectDB()) {
        const gone = await Staff.deleteOne({ _id: officerId, email: officerEmail });
        if (gone.deletedCount === 1) pass('4.02 Export test officer removed from the database');
        else fail('4.02 Export test officer removed from the database', 'deleted ' + gone.deletedCount);
        await disconnectDB();
      }
    } catch (e) {
      console.log('SKIP  4.02 direct officer cleanup (' + e.message + ')');
    }
  }

  console.log('\nZIP files kept for inspection: ' + TMP);
  finish();
}

function finish() {
  console.log('\n' + '='.repeat(50));
  console.log(`EXPORT RESULT: ${PASS.length} passed, ${FAIL.length} failed`);
  console.log('='.repeat(50));
  process.exit(FAIL.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
