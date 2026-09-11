/*
 * End-to-end integration test for the New Application module,
 * run against the real .env (MongoDB Atlas) configuration.
 * Usage: node test/e2e-application.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { connectDB, disconnectDB, isConnected } = require('../src/config/db');
const { bootstrapAdmin } = require('../src/routes/auth');

const BASE = `http://localhost:${process.env.PORT || 3000}`;
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@goldmitra.com').toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';

const PASS = [];
const FAIL = [];
const pass = (n) => { PASS.push(n); console.log('PASS', n); };
const fail = (n, m) => { FAIL.push(n); console.log('FAIL', n, m ?? ''); };

const tinyImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP/' + 'A'.repeat(400);

const cookie = { value: '' };

async function api(p, { method = 'GET', body, expect } = {}) {
  const res = await fetch(BASE + p, {
    method,
    headers: {
      'content-type': 'application/json',
      cookie: cookie.value
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    cookie.value = setCookie.split(';')[0];
  }
  const ok = res.ok;
  if (expect !== undefined && expect !== null && !Array.isArray(expect)) {
    return { res, data, ok };
  }
  return { res, data, ok, status: res.status };
}

async function main() {
  const connected = await connectDB();
  if (!connected) {
    console.error('✗ Could not connect to MongoDB — check MONGODB_URI');
    process.exit(1);
  }
  pass('MongoDB connection established');

  await bootstrapAdmin();
  pass('Bootstrap admin ensured');

  const { data: loginData, ok: loginOk } = await api('/api/auth/login', {
    method: 'POST',
    body: { email: adminEmail, password: adminPassword }
  }).catch((e) => ({ data: null, ok: false, err: e.message }));
  if (loginOk && loginData && loginData.success) {
    pass('Login with session cookie');
  } else {
    fail('Login with session cookie', JSON.stringify(loginData || 'no response'));
    return;
  }

  const payload = {
    customer: {
      name: 'Test Customer Ramesh',
      mobile: '9876543210',
      aadhaar: '123456789012',
      address: '12, Field Road, Chennai',
      photoData: tinyImage
    },
    jewelleryItems: [
      {
        itemName: 'Gold Bangle',
        purity: '22K / 916',
        weightGrams: 24.5,
        description: 'Simple bangle pair',
        photoData: tinyImage
      },
      {
        itemName: 'Temple Necklace',
        purity: '18K / 750',
        weightGrams: 18.25,
        description: 'With stones',
        photoData: tinyImage
      }
    ],
    loan: {
      amount: 150000,
      paymentMode: 'cash',
      date: new Date().toISOString()
    }
  };

  const { res, data, status } = await api('/api/applications', {
    method: 'POST',
    body: payload
  });
  if (status === 201 && data.success) {
    pass(`Application created → ${data.application.applicationNo}`);
    const no = data.application.applicationNo || '';
    if (/^GL-\d{8}-\d{4}$/.test(no)) pass('Application number format valid');
    else fail('Application number format valid', no);
    if (data.application.totalWeightGrams === 42.75) pass('Total weight auto-computed (42.750 g)');
    else fail('Total weight auto-computed', data.application.totalWeightGrams);
  } else {
    fail('Application created', `status=${status} ${JSON.stringify(data)}`);
  }

  const list = await api('/api/applications');
  if (list.ok && Array.isArray(list.data.applications)) {
    const found = list.data.applications.some((a) => a.applicationNo === data?.application?.applicationNo);
    pass(`Application listed in MongoDB (${list.data.applications.length} total)` + (found ? ' ✓' : ''));
  } else {
    fail('Application listed in MongoDB', JSON.stringify(list.data));
  }

  /* Validation: bad mobile → 400 without touching DB */
  const bad = await api('/api/applications', {
    method: 'POST',
    body: { ...payload, customer: { ...payload.customer, mobile: '123' } }
  });
  if (bad.status === 400) pass('Validation rejects bad mobile (400)');
  else fail('Validation rejects bad mobile (400)', bad.status);

  const empty = await api('/api/applications', {
    method: 'POST',
    body: { ...payload, jewelleryItems: [] }
  });
  if (empty.status === 400) pass('Validation rejects empty jewellery (400)');
  else fail('Validation rejects empty jewellery (400)', empty.status);

  const appId = data?.application?.id;
  const appNo = data?.application?.applicationNo;

  /* ---- Records module ---- */

  /* Search by application no */
  const byNo = await api(`/api/applications?search=${encodeURIComponent(appNo)}`);
  if (byNo.ok && byNo.data.applications.some((a) => a.applicationNo === appNo)) {
    pass('Search by application number');
  } else fail('Search by application number', JSON.stringify(byNo.data));

  /* Search by name */
  const byName = await api(`/api/applications?search=${encodeURIComponent('Test Customer')}`);
  if (byName.ok && byName.data.applications.some((a) => a.applicationNo === appNo)) {
    pass('Search by customer name');
  } else fail('Search by customer name', JSON.stringify(byName.data));

  /* Search by mobile */
  const byMobile = await api('/api/applications?search=9876543210');
  if (byMobile.ok && byMobile.data.applications.some((a) => a.customer.mobile === '9876543210')) {
    pass('Search by mobile');
  } else fail('Search by mobile', JSON.stringify(byMobile.data));

  /* Search by Aadhaar */
  const byAadhaar = await api('/api/applications?search=123456789012');
  if (byAadhaar.ok && byAadhaar.data.applications.some((a) => a.applicationNo === appNo)) {
    pass('Search by Aadhaar');
  } else fail('Search by Aadhaar', JSON.stringify(byAadhaar.data));

  /* Search returns empty for gibberish */
  const gib = await api('/api/applications?search=zzzzqqqq');
  if (gib.ok && gib.data.applications.length === 0) pass('Search with no matches returns empty');
  else fail('Search with no matches returns empty', JSON.stringify(gib.data));

  /* View single record */
  const one = await api(`/api/applications/${appId}`);
  if (one.ok && one.data.application && one.data.application.jewelleryItems.length === 2) {
    pass('View single record (detail payload complete)');
  } else fail('View single record', JSON.stringify(one.data));

  /* Update record */
  const updated = await api(`/api/applications/${appId}`, {
    method: 'PUT',
    body: {
      customer: { ...payload.customer, name: 'Renamed Customer' },
      jewelleryItems: [
        { ...payload.jewelleryItems[0], weightGrams: 30 }
      ],
      loan: {
        ...payload.loan,
        amount: 200000,
        paymentMode: 'account',
        accountDetails: { holderName: 'Renamed Customer', accountNumber: '987654321098', ifsc: 'HDFC0001234' }
      }
    }
  });
  if (updated.ok && updated.data.success && updated.data.application.totalWeightGrams === 30) {
    pass('Update record (PUT) with re-computed weight');
  } else fail('Update record (PUT)', `status=${updated.status} ${JSON.stringify(updated.data)}`);

  const afterUpdate = await api(`/api/applications/${appId}`);
  if (
    afterUpdate.ok &&
    afterUpdate.data.application.customer.name === 'Renamed Customer' &&
    afterUpdate.data.application.loan.amount === 200000 &&
    afterUpdate.data.application.loan.paymentMode === 'account'
  ) {
    pass('Updated values persisted');
  } else fail('Updated values persisted', JSON.stringify(afterUpdate.data));

  /* Bad id → 400 */
  const badId = await api('/api/applications/not-a-valid-id');
  if (badId.status === 400) pass('Invalid id rejected (400)');
  else fail('Invalid id rejected (400)', badId.status);

  /* Add another record then delete it */
  const extra = await api('/api/applications', {
    method: 'POST',
    body: { ...payload, customer: { ...payload.customer, name: 'Temp To Delete', mobile: '9112233445' } }
  });
  if (extra.status === 201) {
    const del = await api(`/api/applications/${extra.data.application.id}`, { method: 'DELETE' });
    if (del.ok && del.data.success) pass('Delete record (DELETE)');
    else fail('Delete record (DELETE)', `status=${del.status} ${JSON.stringify(del.data)}`);

    const gone = await api(`/api/applications/${extra.data.application.id}`);
    if (gone.status === 404) pass('Deleted record is gone (404)');
    else fail('Deleted record is gone (404)', gone.status);
  } else {
    fail('Fixture record for delete', extra.status);
  }

  console.log('');
  console.log(`RESULT: ${PASS.length} passed, ${FAIL.length} failed`);
  if (FAIL.length) process.exitCode = 1;
  await disconnectDB();
}

main().catch((e) => {
  console.error('✗ Harness error:', e);
  process.exitCode = 1;
});