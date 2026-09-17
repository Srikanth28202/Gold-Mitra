const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Staff = require('../models/Staff');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const isConnected = () => mongoose.connection.readyState === 1;

const clean = (v) => String(v ?? '').trim();
const ROLES = ['admin', 'field-officer', 'manager'];
const BCRYPT_ROUNDS = 12;

const PUBLIC_FIELDS = '_id name email phone role isActive lastLoginAt createdAt';

function validatePayload(body) {
  const errors = [];

  if (!clean(body.name) || clean(body.name).length < 2) {
    errors.push('Full name is required');
  }
  if (!/^\S+@\S+\.\S+$/.test(clean(body.email))) {
    errors.push('A valid email address is required');
  }
  if (!clean(body.password) || clean(body.password).length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (body.role && !ROLES.includes(body.role)) {
    errors.push('Role must be one of: ' + ROLES.join(', '));
  }

  return errors;
}

/* List staff (admin only) */
router.get('/api/staff', requireAuth, requireAdmin, async (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database unavailable. Please check your connection and try again.' });
  }
  try {
    const staff = await Staff.find({}, PUBLIC_FIELDS).sort({ createdAt: -1 });
    res.json({ staff });
  } catch (err) {
    console.error('✗ Staff list error:', err.message);
    res.status(500).json({ error: 'Could not load team members.' });
  }
});

/* Create a staff member (admin only) */
router.post('/api/staff', requireAuth, requireAdmin, async (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database unavailable. Please check your connection and try again.' });
  }

  const errors = validatePayload(req.body);
  if (errors.length) {
    return res.status(400).json({ error: 'Please fix the highlighted fields.', errors });
  }

  try {
    const passwordHash = await bcrypt.hash(req.body.password, BCRYPT_ROUNDS);
    const member = await Staff.create({
      name: clean(req.body.name),
      email: clean(req.body.email).toLowerCase(),
      phone: clean(req.body.phone),
      passwordHash,
      role: req.body.role || 'field-officer'
    });

    res.status(201).json({
      success: true,
      member: {
        _id: member._id.toString(),
        name: member.name,
        email: member.email,
        phone: member.phone,
        role: member.role,
        isActive: member.isActive,
        createdAt: member.createdAt
      }
    });
  } catch (err) {
    console.error('✗ Staff create error:', err.message);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }
    res.status(500).json({ error: 'Could not create the user. Please try again.' });
  }
});

/* Parse bulk text: one member per line -> Name, Email, Phone (phone optional).
   Supports comma or tab separators and optional surrounding quotes. */
function parseMembers(text) {
  const rows = [];
  const seen = new Set();

  String(text || '')
    .split(/\r?\n/)
    .forEach((raw, idx) => {
      const line = (raw || '').trim();
      if (!line) return;

      const cells = line
        .split('\t')
        .join(',')
        .split(',')
        .map((c) => String(c || '').replace(/^["']|["']$/g, '').trim());

      const [name = '', email = '', phone = ''] = cells;
      if (!name && !email) return;

      rows.push({
        line: idx + 1,
        name,
        email: email.toLowerCase(),
        phone,
        duplicateInside: email ? seen.has(email.toLowerCase()) : false
      });
      if (email) seen.add(email.toLowerCase());
    });

  return rows;
}

/* Bulk create staff members (admin only) */
router.post('/api/staff/bulk', requireAuth, requireAdmin, async (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database unavailable. Please check your connection and try again.' });
  }

  const password = String(req.body.password || '');
  const role = req.body.role || 'field-officer';

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.', errors: ['Password must be at least 8 characters.'] });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: 'Role must be one of: ' + ROLES.join(', ') });
  }

  const members = parseMembers(req.body.text);
  if (!members.length) {
    return res.status(400).json({ error: 'No users found. Add one member per line as: Name, Email, Phone' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const results = { inserted: 0, errors: [] };

    for (const m of members) {
      const errs = [];
      if (m.duplicateInside) errs.push('Duplicate email in the list');
      if (m.name.length < 2) errs.push('Full name is required');
      if (!/^\S+@\S+\.\S+$/.test(m.email)) errs.push('Invalid email');
      if (m.phone && !/^[6-9]\d{9}$/.test(m.phone)) errs.push('Invalid 10-digit mobile');

      if (errs.length) {
        results.errors.push({ line: m.line, email: m.email, reason: errs.join('; ') });
        continue;
      }

      try {
        await Staff.create({
          name: m.name,
          email: m.email,
          phone: m.phone,
          passwordHash,
          role
        });
        results.inserted += 1;
      } catch (err) {
        const reason = err && err.code === 11000
          ? 'A user with this email already exists'
          : 'Could not create the user';
        results.errors.push({ line: m.line, email: m.email, reason });
      }
    }

    res.status(results.inserted ? 201 : 400).json({
      success: results.inserted > 0,
      total: members.length,
      inserted: results.inserted,
      errors: results.errors
    });
  } catch (err) {
    console.error('✗ Staff bulk create error:', err.message);
    res.status(500).json({ error: 'Could not create the users. Please try again.' });
  }
});

/* Activate / deactivate a staff member (admin only, never self) */
router.patch('/api/staff/:id/active', requireAuth, requireAdmin, async (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database unavailable. Please check your connection and try again.' });
  }
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user id.' });
  }
  if (String(req.params.id) === String(req.session.userId)) {
    return res.status(400).json({ error: 'You cannot deactivate your own account.' });
  }

  try {
    const member = await Staff.findById(req.params.id);
    if (!member) return res.status(404).json({ error: 'User not found.' });

    member.isActive = !member.isActive;
    await member.save();

    res.json({
      success: true,
      member: {
        _id: member._id.toString(),
        name: member.name,
        isActive: member.isActive
      }
    });
  } catch (err) {
    console.error('✗ Staff toggle error:', err.message);
    res.status(500).json({ error: 'Could not update the user.' });
  }
});

module.exports = router;