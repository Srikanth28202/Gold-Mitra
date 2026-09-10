const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { isConnected } = require('../config/db');
const Application = require('../models/Application');
const Staff = require('../models/Staff');

const router = express.Router();

const DAY_MS = 24 * 60 * 60 * 1000;

function dayStartUtc(offsetDays = 0) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
}

router.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  try {
    const filter = {};
    if (req.session.role !== 'admin') filter.staff = req.session.userId;

    const todayStart = dayStartUtc(0);
    const tomorrowStart = dayStartUtc(1);

    const [totalApplications, todayCount, todaySum, portfolioSum, chartGroups, recent, teamRows, todayStaffGroups] =
      await Promise.all([
        Application.countDocuments(filter),

        Application.countDocuments({ ...filter, createdAt: { $gte: todayStart, $lt: tomorrowStart } }),

        Application.aggregate([
          { $match: { ...filter, createdAt: { $gte: todayStart, $lt: tomorrowStart } } },
          { $group: { _id: null, total: { $sum: '$loan.amount' } } }
        ]),

        Application.aggregate([
          { $match: filter },
          { $group: { _id: null, total: { $sum: '$loan.amount' } } }
        ]),

        Application.aggregate([
          { $match: { ...filter, createdAt: { $gte: dayStartUtc(-6) } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              total: { $sum: '$loan.amount' }
            }
          }
        ]),

        Application.find(filter)
          .sort({ createdAt: -1 })
          .limit(5)
          .select('applicationNo status customer.name totalWeightGrams createdAt loan.amount')
          .lean(),

        Staff.find({})
          .select('name role isActive')
          .sort({ name: 1 })
          .lean(),

        Application.aggregate([
          { $match: { createdAt: { $gte: todayStart, $lt: tomorrowStart } } },
          { $group: { _id: '$staff', count: { $sum: 1 } } }
        ])
      ]);

    const todayDisbursed = (todaySum[0] && todaySum[0].total) || 0;
    const portfolio = (portfolioSum[0] && portfolioSum[0].total) || 0;

    const labels = [];
    const values = [];
    for (let i = 6; i >= 0; i--) {
      const day = dayStartUtc(-i);
      const key = day.toISOString().slice(0, 10);
      labels.push(day.toLocaleDateString('en-IN', { weekday: 'short' }));
      const hit = chartGroups.find((g) => g._id === key);
      values.push(hit ? hit.total : 0);
    }

    const staffMap = new Map(todayStaffGroups.map((g) => [String(g._id), g.count]));
    const teamToday = teamRows.map((m) => ({
      name: m.name,
      role: m.role,
      isActive: m.isActive !== false,
      applicationsToday: staffMap.get(String(m._id)) || 0
    }));

    res.json({
      scope: req.session.role !== 'admin' ? 'own' : 'all',
      stats: {
        totalApplications,
        todayApplications: todayCount,
        todayDisbursed,
        portfolio
      },
      chart: { labels, values },
      recent: recent.map((a) => ({
        id: a._id,
        applicationNo: a.applicationNo,
        customerName: a.customer && a.customer.name,
        weightGrams: a.totalWeightGrams,
        amount: a.loan && a.loan.amount,
        status: a.status,
        createdAt: a.createdAt
      })),
      teamToday
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: isConnected() ? 'connected' : 'disconnected' });
});

module.exports = router;