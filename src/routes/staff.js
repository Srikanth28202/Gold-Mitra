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