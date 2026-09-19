const express = require('express');
const Application = require('../models/Application');
const Staff = require('../models/Staff');
const { requireAuth } = require('../middleware/auth');
const { isConnected } = require('../config/db');

const router = express.Router();

const DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_KEYS = ['pending', 'approved', 'rejected', 'disbursed'];
const STATUS_LABELS = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', disbursed: 'Disbursed' };

function startOfDayUtc(offsetDays) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + (offsetDays || 0));
  return d;
}

function pivotStatus(rows) {
  const counts = { pending: 0, approved: 0, rejected: 0, disbursed: 0 };
  const amounts = { pending: 0, approved: 0, rejected: 0, disbursed: 0 };
  rows.forEach((r) => {
    const key = r._id;
    if (STATUS_KEYS.indexOf(key) !== -1) {
      counts[key] = r.count || 0;
      amounts[key] = r.amount || 0;
    }
  });
  return { counts, amounts };
}

router.get('/api/analytics/summary', requireAuth, async (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database unavailable. Please try again.' });
  }

  const isAdmin = req.session.role === 'admin';
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
  const periodStart = startOfDayUtc(-(days - 1));
  const todayStart = startOfDayUtc(0);
  const tomorrowStart = startOfDayUtc(1);
  const staffFilter = isAdmin ? {} : { staff: req.session.userId };

  try {
    const [
      overallRows,
      todayRows,
      periodStatusRows,
      statusStaffRows,
      staffList
    ] = await Promise.all([
      Application.aggregate([
        { $match: staffFilter },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$loan.amount' } } }
      ]),
      Application.aggregate([
        { $match: { ...staffFilter, createdAt: { $gte: todayStart, $lt: tomorrowStart } } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$loan.amount' } } }
      ]),
      Application.aggregate([
        { $match: { ...staffFilter, createdAt: { $gte: periodStart } } },
        { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$loan.amount' } } }
      ]),
      Application.aggregate([
        { $match: { ...staffFilter, createdAt: { $gte: periodStart } } },
        {
          $group: {
            _id: { staff: '$staff', status: '$status' },
            count: { $sum: 1 },
            amount: { $sum: '$loan.amount' }
          }
        }
      ]),
      Staff.find(isAdmin ? {} : { _id: req.session.userId })
        .select('name email role isActive')
        .sort({ name: 1 })
        .lean()
    ]);

    const overall = overallRows[0] || { count: 0, amount: 0 };
    const today = todayRows[0] || { count: 0, amount: 0 };
    const periodStatus = pivotStatus(periodStatusRows);

    const staffMap = new Map();
    const detailMap = new Map();
    statusStaffRows.forEach((r) => {
      const staffId = String(r._id.staff);
      const key = String(r._id.status);
      if (!staffMap.has(staffId)) staffMap.set(staffId, { count: 0, amount: 0 });
      const agg = staffMap.get(staffId);
      agg.count += r.count;
      agg.amount += r.amount;
      if (!detailMap.has(staffId)) detailMap.set(staffId, { counts: { pending: 0, approved: 0, rejected: 0, disbursed: 0 }, amounts: { pending: 0, approved: 0, rejected: 0, disbursed: 0 } });
      const d = detailMap.get(staffId);
      if (STATUS_KEYS.indexOf(key) !== -1) {
        d.counts[key] = r.count;
        d.amounts[key] = r.amount;
      }
    });

    const team = staffList.map((m) => {
      const s = staffMap.get(String(m._id)) || { count: 0, amount: 0 };
      const d = detailMap.get(String(m._id)) || { counts: { pending: 0, approved: 0, rejected: 0, disbursed: 0 }, amounts: { pending: 0, approved: 0, rejected: 0, disbursed: 0 } };
      return {
        _id: String(m._id),
        name: m.name,
        email: m.email,
        role: m.role,
        isActive: m.isActive !== false,
        applications: s.count,
        amount: s.amount,
        byStatus: d
      };
    });

    res.json({
      scope: isAdmin ? 'all' : 'own',
      days,
      overall: {
        applications: overall.count,
        amount: overall.amount,
        todayApplications: today.count,
        todayAmount: today.amount,
        byStatus: { ...periodStatus.counts }
      },
      byStatusAmounts: periodStatus.amounts,
      team
    });
  } catch (err) {
    console.error('Analytics error:', err.message);
    res.status(500).json({ error: 'Could not load analytics. Please try again.' });
  }
});

module.exports = router;