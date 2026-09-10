const express = require('express');
const mongoose = require('mongoose');
const Application = require('../models/Application');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const isConnected = () => mongoose.connection.readyState === 1;

const clean = (v) => String(v ?? '').trim();

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const canAccess = (application, req) =>
  req.session.role === 'admin' ||
  String(application.staff) === String(req.session.userId);

function buildApplicationFields(b) {
  const items = b.jewelleryItems.map((item) => ({
    itemName: clean(item.itemName),
    purity: clean(item.purity),
    weightGrams: Number(item.weightGrams),
    description: clean(item.description),
    photoData: item.photoData || ''
  }));

  const totalWeightGrams = items.reduce((sum, i) => sum + i.weightGrams, 0);

  return {
    customer: {
      name: clean(b.customer.name),
      mobile: clean(b.customer.mobile),
      aadhaar: clean(b.customer.aadhaar),
      address: clean(b.customer.address),
      photoData: b.customer.photoData || ''
    },
    jewelleryItems: items,
    totalWeightGrams: Math.round(totalWeightGrams * 1000) / 1000,
    loan: {
      amount: Number(b.loan.amount),
      paymentMode: b.loan.paymentMode,
      date: new Date(b.loan.date)
    }
  };
}

function validatePayload(body) {
  const errors = [];

  if (!clean(body.customer?.name) || clean(body.customer.name).length < 2) {
    errors.push('Customer name is required');
  }
  if (!/^[6-9]\d{9}$/.test(clean(body.customer?.mobile))) {
    errors.push('Valid 10-digit mobile number is required');
  }
  if (body.customer?.aadhaar && !/^\d{12}$/.test(clean(body.customer.aadhaar))) {
    errors.push('Aadhaar must be 12 digits');
  }
  if (!clean(body.customer?.address)) {
    errors.push('Customer address is required');
  }
  if (!body.customer?.photoData) {
    errors.push('Customer photo is required');
  }

  if (!Array.isArray(body.jewelleryItems) || body.jewelleryItems.length === 0) {
    errors.push('At least one jewellery item is required');
  } else {
    body.jewelleryItems.forEach((item, i) => {
      const n = i + 1;
      if (!clean(item.itemName)) errors.push(`Item ${n}: name is required`);
      if (!clean(item.purity)) errors.push(`Item ${n}: purity is required`);
      if (!(Number(item.weightGrams) > 0)) errors.push(`Item ${n}: valid weight is required`);
      if (!item.photoData) errors.push(`Item ${n}: photo is required`);
    });
  }

  if (!(Number(body.loan?.amount) >= 1)) {
    errors.push('Loan amount is required');
  }
  if (!['cash', 'account'].includes(body.loan?.paymentMode)) {
    errors.push('Payment mode is required');
  }
  const d = new Date(body.loan?.date);
  if (Number.isNaN(d.getTime())) {
    errors.push('Loan date is required');
  }

  return errors;
}

router.post('/api/applications', requireAuth, async (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database unavailable. Please check your connection and try again.' });
  }

  const errors = validatePayload(req.body);
  if (errors.length) {
    return res.status(400).json({ error: 'Please fix the highlighted fields.', errors });
  }

  try {
    const application = new Application({
      applicationNo: '',
      staff: req.session.userId,
      ...buildApplicationFields(req.body)
    });

    application.applicationNo = application.generateApplicationNo();
    await application.save();

    res.status(201).json({
      success: true,
      application: {
        id: application._id.toString(),
        applicationNo: application.applicationNo,
        totalWeightGrams: application.totalWeightGrams,
        amount: application.loan.amount,
        date: application.loan.date
      }
    });
  } catch (err) {
    console.error('✗ Application create error:', err.message);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Duplicate application number. Please retry.' });
    }
    res.status(500).json({ error: 'Could not save the application. Please try again.' });
  }
});

router.get('/api/applications', requireAuth, async (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database unavailable. Please check your connection and try again.' });
  }
  try {
    const filter = {};
    if (req.session.role !== 'admin') filter.staff = req.session.userId;

    const q = clean(req.query.search);
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [
        { 'customer.name': rx },
        { 'customer.mobile': rx },
        { 'customer.aadhaar': rx },
        { applicationNo: rx }
      ];
    }

    const applications = await Application.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .select(
        '_id applicationNo status customer.name customer.mobile loan.amount loan.date totalWeightGrams createdAt'
      );

    res.json({ applications, total: applications.length });
  } catch (err) {
    console.error('✗ Application list error:', err.message);
    res.status(500).json({ error: 'Could not load applications' });
  }
});

router.get('/api/applications/:id', requireAuth, async (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database unavailable. Please check your connection and try again.' });
  }
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid record id' });
  }
  try {
    const application = await Application.findById(req.params.id).populate('staff', 'name role');
    if (!application) return res.status(404).json({ error: 'Record not found' });
    if (!canAccess(application, req)) return res.status(403).json({ error: 'You do not have access to this record' });
    res.json({ application });
  } catch (err) {
    console.error('✗ Application get error:', err.message);
    res.status(500).json({ error: 'Could not load the record' });
  }
});

router.put('/api/applications/:id', requireAuth, async (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database unavailable. Please check your connection and try again.' });
  }
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid record id' });
  }

  const errors = validatePayload(req.body);
  if (errors.length) {
    return res.status(400).json({ error: 'Please fix the highlighted fields.', errors });
  }

  try {
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ error: 'Record not found' });
    if (!canAccess(application, req)) return res.status(403).json({ error: 'You do not have access to this record' });

    Object.assign(application, buildApplicationFields(req.body));
    await application.save();

    res.json({
      success: true,
      application: {
        id: application._id.toString(),
        applicationNo: application.applicationNo,
        totalWeightGrams: application.totalWeightGrams,
        amount: application.loan.amount,
        date: application.loan.date,
        status: application.status,
        updatedAt: application.updatedAt
      }
    });
  } catch (err) {
    console.error('✗ Application update error:', err.message);
    res.status(500).json({ error: 'Could not update the record. Please try again.' });
  }
});

router.delete('/api/applications/:id', requireAuth, async (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database unavailable. Please check your connection and try again.' });
  }
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid record id' });
  }
  try {
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ error: 'Record not found' });
    if (!canAccess(application, req)) return res.status(403).json({ error: 'You do not have access to this record' });

    const appNo = application.applicationNo;
    await Application.deleteOne({ _id: application._id });

    res.json({ success: true, deletedApplicationNo: appNo });
  } catch (err) {
    console.error('✗ Application delete error:', err.message);
    res.status(500).json({ error: 'Could not delete the record. Please try again.' });
  }
});

module.exports = router;