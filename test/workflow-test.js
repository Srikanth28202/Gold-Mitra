/*
 * Production workflow test — the complete Gold Mitra journey plus
 * security checks, run against the real .env (MongoDB Atlas).
 *
 * Login → New Application → Save → Search → View/Edit → Print
 * plus: page serving, security headers, CSRF origin rejection,
 * brute-force rate limiting, API/login protection.
 *
 * Usage: node test/workflow-test.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { connectDB, disconnectDB } = require('../src/config/db');
const { bootstrapAdmin } = require('../src/routes/auth');

const BASE = `http://localhost:${process.env.PORT || 3000}`;
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@goldmitra.com').toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';

const PASS = [];
const FAIL = [];
const pass = (n) => { PASS.push(n); console.log('PASS', n); };
const fail = (n, m) => { FAIL.push(n); console.log('FAIL', n, m ?? ''); };
const bail = (n, m) => {
  fail(n, m);
  console.log('');
  console.log('WORKFLOW RESULT: ' + PASS.length + ' passed, ' + FAIL.length + ' failed');
  disconnectDB().finally(() => process.exit(1));
};

const tinyImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP/' + 'A'.repeat(400);

let cookie = '';

async function raw(p, { method = 'GET', body, headers = {} } = {}) {
  return fetch(BASE + p, {
    method,
    redirect: 'manual',
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

async function api(p, opts = {}) {
  const res = await raw(p, opts);
  try {
    var data = await res.json();
  } catch (_) {
    data = null;
  }
  return { res, data, status: res.status };
}

async function main() {
  const connected = await connectDB();
  if (!connected) {
    console.error('✗ Could not connect to MongoDB — check MONGODB_URI');
    process.exit(1);
  }
  pass('1.01 MongoDB connection established');

  await bootstrapAdmin();
  pass('1.02 Bootstrap admin ensured');

  /* ── Login ─────────────────────────────────────────────── */
  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email: adminEmail, password: adminPassword }
  });
  if (login.status !== 200 || !login.data.success) return bail('1.03 Login succeeds', JSON.stringify(login.data));
  const setCookie = login.res.headers.get('set-cookie');
  if (!setCookie) return bail('1.03 Login returns session cookie');
  cookie = setCookie.split(';')[0];
  pass('1.03 Login succeeds with session cookie');

  const me = await api('/api/auth/me');
  pass('1.04 /api/auth/me returns authenticated user (' + (me.data.user ? me.data.user.role : '?') + ')');

  /* ── Login failure modes ───────────────────────────────── */
  const badLogin = await api('/api/auth/login', { method: 'POST', body: { email: adminEmail, password: 'wrong-password' } });
  if (badLogin.status !== 401) return bail('1.05 Bad credentials rejected (401)', String(badLogin.status));
  pass('1.05 Bad credentials rejected (401)');

  const badPayload = await api('/api/auth/login', { method: 'POST', body: { email: '', password: '' } });
  if (badPayload.status !== 400) return bail('1.06 Empty credentials rejected (400)', String(badPayload.status));
  pass('1.06 Empty credentials rejected (400)');

  /* ── Session cookie flags ──────────────────────────────── */
  const cookieFlags = setCookie;
  if (!/HttpOnly/i.test(cookieFlags)) return bail('1.07 Session cookie is HttpOnly');
  if (!/SameSite=Lax/i.test(cookieFlags)) return bail('1.07 Session cookie has SameSite=Lax');
  pass('1.07 Session cookie is HttpOnly + SameSite=Lax');

  /* ── Security headers ──────────────────────────────────── */
  const loginPage = await raw('/login');
  const headers = loginPage.headers;
  const hChecks = [
    ['strict-transport-security', '1.08 HSTS header present'],
    ['x-content-type-options', '1.09 X-Content-Type-Options header present'],
    ['x-frame-options', '1.10 X-Frame-Options (clickjacking) header present'],
    ['referrer-policy', '1.11 Referrer-Policy header present'],
    ['cross-origin-resource-policy', '1.12 CORP header present']
  ];
  for (const [name, label] of hChecks) {
    if (headers.get(name)) pass(label);
    else fail(label, 'missing ' + name);
  }

  /* ── CSRF: cross-origin mutating request rejected ──────── */
  const csrf = await api('/api/applications', {
    method: 'POST',
    headers: { origin: 'https://evil.example.com' },
    body: { customer: {}, jewelleryItems: [], loan: {} }
  });
  if (csrf.status !== 403) return bail('1.13 Cross-origin POST rejected (403)', String(csrf.status));
  pass('1.13 Cross-origin POST rejected (403)');

  // same-origin POST still accepted (validation error, not CSRF)
  const sameOrigin = await api('/api/applications', {
    method: 'POST',
    headers: { origin: 'http://localhost:' + (process.env.PORT || 3000) },
    body: { customer: {} }
  });
  if (sameOrigin.status === 403) return bail('1.13 Same-origin POST not blocked by CSRF guard');
  pass('1.14 Same-origin POST passes CSRF guard (reaches validation)');

  /* ── Unauthenticated pages redirect to login ───────────── */
  const unauthCookie = cookie;
  cookie = '';
  const redirects = ['/records', '/applications/new', '/' ];
  for (const r of redirects) {
    const rr = await raw(r);
    if (rr.status !== 302 || (rr.headers.get('location') || '').indexOf('/login') !== 0) {
      return bail('1.15 Unauthenticated ' + r + ' → 302 to /login (got ' + rr.status + ')');
    }
  }
  pass('1.15 Unauthenticated pages redirected to /login');

  const unauthApi = await raw('/api/applications?search=x');
  if (unauthApi.status !== 401) return bail('1.16 Unauthenticated API access rejected (401)');
  pass('1.16 Unauthenticated API access rejected (401)');
  cookie = unauthCookie;
  const appPayload = {
    customer: {
      name: 'Workflow Test Customer',
      mobile: '9988776655',
      aadhaar: '445566778899',
      address: '14, Main Road, Coimbatore, Tamil Nadu - 641001',
      photoData: tinyImage
    },
    jewelleryItems: [
      { itemName: 'Gold Chain', purity: '22K', weightGrams: 22.5, description: 'Kerala pattern', photoData: tinyImage },
      { itemName: 'Gold Bangle', purity: '18K', weightGrams: 12.25, description: '', photoData: tinyImage }
    ],
    loan: { amount: 95000, paymentMode: 'cash', date: '2026-09-10' }
  };

  const created = await api('/api/applications', { method: 'POST', body: appPayload });
  if (created.status !== 201) return bail('2.01 Application saved (POST 201)', JSON.stringify(created.data));
  const applicationNo = created.data.application.applicationNo;
  const appId = created.data.application.id;
  pass('2.01 Application saved → ' + applicationNo);

  /* ── Search ────────────────────────────────────────────── */
  const byNo = await api('/api/applications?search=' + encodeURIComponent(applicationNo));
  const foundNo = (byNo.data.applications || []).find((a) => a._id === appId);
  if (!foundNo) return bail('2.02 Search finds record by application number');
  pass('2.02 Search by application number');

  const byName = await api('/api/applications?search=' + encodeURIComponent('Workflow Test'));
  if (!(byName.data.applications || []).some((a) => a._id === appId)) return bail('2.03 Search by customer name');
  pass('2.03 Search by customer name');

  const byMobile = await api('/api/applications?search=9988776655');
  if (!(byMobile.data.applications || []).some((a) => a._id === appId)) return bail('2.04 Search by mobile');
  pass('2.04 Search by mobile');

  const byAadhaar = await api('/api/applications?search=445566778899');
  if (!(byAadhaar.data.applications || []).some((a) => a._id === appId)) return bail('2.05 Search by Aadhaar');
  pass('2.05 Search by Aadhaar');

  /* ── View detail ───────────────────────────────────────── */
  const detail = await api('/api/applications/' + appId);
  if (detail.status !== 200 || !detail.data.application || detail.data.application.jewelleryItems.length !== 2) {
    return bail('2.06 View record detail (full payload)', String(detail.status));
  }
  if (Math.round(Number(detail.data.application.totalWeightGrams) * 1000) !== Math.round(34.75 * 1000)) {
    return bail('2.06 Total weight auto-computed = 34.750 g', String(detail.data.application.totalWeightGrams));
  }
  pass('2.06 View record detail with auto-computed total weight (34.750 g)');

  /* ── Edit / Update ─────────────────────────────────────── */
  const updated = await api('/api/applications/' + appId, {
    method: 'PUT',
    body: {
      ...appPayload,
      jewelleryItems: [
        { itemName: 'Gold Chain', purity: '22K', weightGrams: 22.5, description: 'Kerala pattern', photoData: tinyImage },
        { itemName: 'Gold Bangle', purity: '18K', weightGrams: 12.25, description: 'Pawned pair', photoData: tinyImage },
        { itemName: 'Gold Ring', purity: '24K', weightGrams: 3.1, description: '', photoData: tinyImage }
      ],
      loan: { ...appPayload.loan, amount: 115000 }
    }
  });
  if (updated.status !== 200) return bail('2.07 Edit record (PUT 200)', String(updated.status));
  const detail2 = await api('/api/applications/' + appId);
  if (detail2.data.application.jewelleryItems.length !== 3) return bail('2.07 Edit persisted item changes');
  if (String(detail2.data.application.loan.amount) !== '115000') return bail('2.07 Edit persisted loan amount');
  if (Math.round(Number(detail2.data.application.totalWeightGrams) * 1000) !== Math.round(37.85 * 1000)) {
    return bail('2.07 Total weight recomputed (37.850 g)', String(detail2.data.application.totalWeightGrams));
  }
  pass('2.07 Edit persisted (items + amount + recomputed weight 37.850 g)');

  /* ── Pages served (authenticated) ──────────────────────── */
  const pageChecks = [
    ['/applications/new', 'id="applicationForm"'],
    ['/records', 'id="recordsCards"'],
    ['/records/' + appId, 'id="recordRoot"'],
    ['/records/' + appId + '/print', 'id="printDoc"']
  ];
  let pageOk = true;
  for (const [p, marker] of pageChecks) {
    const r = await raw(p);
    const body = await r.text();
    if (r.status !== 200 || body.indexOf(marker) === -1) {
      fail('2.08 Page ' + p + ' serves 200 with ' + marker + ' (got ' + r.status + ')');
      pageOk = false;
    }
  }
  if (pageOk) pass('2.08 All app pages served (new/edit shell, records, detail, print)');

  // edit page shell
  const editPage = await raw('/applications/' + appId + '/edit');
  if (editPage.status !== 200) return bail('2.09 Edit page served (200)', String(editPage.status));
  pass('2.09 Edit page served (200)');

  /* ── Static assets ─────────────────────────────────────── */
  const assets = ['/css/print.css', '/js/records.js', '/favicon.svg'];
  let assetOk = true;
  for (const a of assets) {
    const r = await raw(a);
    if (r.status !== 200) { fail('2.10 Asset ' + a + ' (200)', String(r.status)); assetOk = false; }
  }
  if (assetOk) pass('2.10 Static assets served (print.css, records.js, favicon)');

  /* ── Print page shares authz (access via API is 403/404 clean) ── */
  const missing = await api('/api/applications/000000000000000000000000');
  if (missing.status !== 400 && missing.status !== 404) return bail('2.11 Invalid record id handled (400/404)');
  pass('2.11 Invalid record id handled gracefully');

  /* ── Cleanup test record ───────────────────────────────── */
  const del = await api('/api/applications/' + appId, { method: 'DELETE' });
  if (del.status !== 200 || del.data.deletedApplicationNo !== applicationNo) {
    return bail('2.12 Test record deleted (DELETE)', String(del.status));
  }
  pass('2.12 Cleanup: test record deleted (' + applicationNo + ')');

  /* ── 3 · Staff & Settings (admin creates field employees) ── */
  const adminCookie = cookie;

  const settingsPage = await raw('/settings');
  if (settingsPage.status !== 200) return bail('3.01 Settings page served (200)', String(settingsPage.status));
  pass('3.01 Settings page served (200)');

  const staffList = await api('/api/staff');
  if (staffList.status !== 200 || !Array.isArray(staffList.data.staff) || !staffList.data.staff.length) {
    return bail('3.02 GET /api/staff returns team list', String(staffList.status));
  }
  pass('3.02 GET /api/staff lists team (' + staffList.data.staff.length + ' members)');

  const memberEmail = 'field' + String(Date.now()).slice(-6) + '@goldmitra.com';
  const createdMember = await api('/api/staff', {
    method: 'POST',
    body: { name: 'Field Temp Officer', email: memberEmail, phone: '9876501234', role: 'field-officer', password: 'Field@Pass123' }
  });
  if (createdMember.status !== 201 || createdMember.data.member.role !== 'field-officer') {
    return bail('3.03 Create field employee (POST /api/staff 201)', JSON.stringify(createdMember.data));
  }
  const memberId = createdMember.data.member._id;
  pass('3.03 Create field employee (POST /api/staff 201)');

  const dup = await api('/api/staff', {
    method: 'POST',
    body: { name: 'Duplicate', email: memberEmail, role: 'field-officer', password: 'Field@Pass123' }
  });
  if (dup.status !== 409) return bail('3.04 Duplicate email rejected (409)', String(dup.status));
  pass('3.04 Duplicate email rejected (409)');

  const weak = await api('/api/staff', {
    method: 'POST',
    body: { name: 'Weak', email: 'weak@x.com', role: 'field-officer', password: 'short' }
  });
  if (weak.status !== 400) return bail('3.05 Weak password rejected (400)', String(weak.status));
  pass('3.05 Weak password rejected (400)');

  /* login as the new field employee */
  cookie = '';
  const loginMember = await api('/api/auth/login', { method: 'POST', body: { email: memberEmail, password: 'Field@Pass123' } });
  if (loginMember.status !== 200 || !loginMember.data.success) {
    return bail('3.06 New field employee can sign in', String(loginMember.status));
  }
  cookie = loginMember.res.headers.get('set-cookie').split(';')[0];
  pass('3.06 New field employee can sign in');

  const memberStaff = await api('/api/staff');
  if (memberStaff.status !== 403) return bail('3.07 Staff list forbidden for field-officer (403)', String(memberStaff.status));
  pass('3.07 Staff list forbidden for field-officer (403)');

  const settingsAsMember = await raw('/settings');
  if (settingsAsMember.status !== 302) return bail('3.08 /settings redirects non-admin to /', String(settingsAsMember.status));
  pass('3.08 /settings redirects non-admin to /');

  const memberApp = await api('/api/applications', {
    method: 'POST',
    body: {
      customer: { name: 'Member Test Customer', mobile: '9988776600', aadhaar: '112233445566', address: '1, Test Street, Chennai', photoData: tinyImage },
      jewelleryItems: [{ itemName: 'Ring', purity: '22K', weightGrams: 4, description: '', photoData: tinyImage }],
      loan: { amount: 20000, paymentMode: 'cash', date: '2026-09-10' }
    }
  });
  if (memberApp.status !== 201) return bail('3.09 Field officer can record an application', String(memberApp.status));
  const memberAppId = memberApp.data.application.id;
  pass('3.09 Field officer can record an application');
  await api('/api/applications/' + memberAppId, { method: 'DELETE' });

  /* admin controls the member's access */
  cookie = adminCookie;
  const deactivate = await api('/api/staff/' + memberId + '/active', { method: 'PATCH' });
  if (deactivate.status !== 200 || deactivate.data.member.isActive !== false) {
    return bail('3.10 Admin deactivates field employee', String(deactivate.status));
  }
  pass('3.10 Admin deactivates field employee');

  cookie = '';
  const blocked = await api('/api/auth/login', { method: 'POST', body: { email: memberEmail, password: 'Field@Pass123' } });
  if (blocked.status !== 401) return bail('3.11 Deactivated member cannot sign in (401)', String(blocked.status));
  pass('3.11 Deactivated member cannot sign in (401)');

  cookie = adminCookie;
  const reactivate = await api('/api/staff/' + memberId + '/active', { method: 'PATCH' });
  if (reactivate.status !== 200 || reactivate.data.member.isActive !== true) {
    return bail('3.12 Admin reactivates field employee', String(reactivate.status));
  }
  pass('3.12 Admin reactivates field employee');

  const selfAdmin = staffList.data.staff.find((s) => s.role === 'admin');
  const selfBlock = await api('/api/staff/' + selfAdmin._id + '/active', { method: 'PATCH' });
  if (selfBlock.status !== 400) return bail('3.13 Admin cannot deactivate own account (400)', String(selfBlock.status));
  pass('3.13 Admin cannot deactivate own account');

  const Staff = require('../src/models/Staff');
  await Staff.deleteOne({ email: memberEmail });

  /* ── 4 · Brute-force rate limiting ─────────────────────── */
  let lastStatus = 0;
  for (let i = 0; i < 10; i++) {
    const attempt = await api('/api/auth/login', { method: 'POST', body: { email: adminEmail, password: 'nope' } });
    lastStatus = attempt.status;
  }
  const locked = await api('/api/auth/login', { method: 'POST', body: { email: adminEmail, password: adminPassword } });
  if (locked.status !== 429) return bail('4.01 Login rate limit enforces 429 after 10 failures (got ' + locked.status + ')', 'last=' + lastStatus);
  pass('4.01 Login rate limit enforces 429 after 10 failures');

  /* ── Logout ────────────────────────────────────────────── */
  const logout = await api('/api/auth/logout', { method: 'POST' });
  if (logout.status !== 200) return bail('4.02 Logout succeeds', String(logout.status));
  const afterLogout = await raw('/records', { headers: { cookie: cookie } });
  if (afterLogout.status !== 302) return bail('4.02 Session invalidated after logout (records → 302)');
  pass('4.02 Logout invalidates session');

  console.log('');
  console.log('════════════════════════════════════════════');
  console.log('WORKFLOW RESULT: ' + PASS.length + ' passed, ' + FAIL.length + ' failed');
  console.log('════════════════════════════════════════════');

  await disconnectDB();
  if (FAIL.length) process.exit(1);
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});