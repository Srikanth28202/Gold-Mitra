const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Staff = require('../models/Staff');

const router = express.Router();

const FALLBACK_ADMIN_PASSWORD = 'Admin@123456';
const isProduction = () => process.env.NODE_ENV === 'production';

async function bootstrapAdmin() {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.warn('Bootstrap admin skipped — database not connected');
      return;
    }
    const count = await Staff.countDocuments();
    if (count > 0) return;

    const name = process.env.ADMIN_NAME || 'Gold Mitra Admin';
    const emailRaw = process.env.ADMIN_EMAIL || 'admin@goldmitra.com';
    const password = process.env.ADMIN_PASSWORD || FALLBACK_ADMIN_PASSWORD;

    /* Never create an admin with a publicly-known default password in production. */
    if (isProduction() && (password === FALLBACK_ADMIN_PASSWORD || !process.env.ADMIN_EMAIL)) {
      console.warn(
        '⚠ Skipping admin bootstrap — set strong production ADMIN_EMAIL/ADMIN_PASSWORD env vars.'
      );
      return;
    }

    const email = emailRaw.toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);
    await Staff.create({ name, email, passwordHash, role: 'admin' });
    console.log('✓ Bootstrap admin created —', email);
  } catch (err) {
    console.error('✗ Bootstrap admin failed:', err.message);
  }
}

router.post('/api/auth/login', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database unavailable. Please check your connection and try again.' });
  }
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const staff = await Staff.findOne({ email: email.toLowerCase().trim() });
    if (!staff || !staff.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await staff.comparePassword(password);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    staff.lastLoginAt = new Date();
    await staff.save();

    req.session.userId = staff._id.toString();
    req.session.role = staff.role;
    req.session.name = staff.name;

    res.json({
      success: true,
      user: { name: staff.name, email: staff.email, role: staff.role }
    });
  } catch (err) {
    console.error('✗ Login error:', err.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Could not log out' });
    res.clearCookie('connect.sid', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
    res.json({ success: true });
  });
});

router.get('/api/auth/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({
    user: {
      name: req.session.name,
      role: req.session.role
    }
  });
});

module.exports = { router, bootstrapAdmin };