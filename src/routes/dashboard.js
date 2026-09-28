const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { isConnected } = require('../config/db');
const Application = require('../models/Application');

const router = express.Router();

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const RECENT_LIMIT = 8;

/* All "today / this week / this month / this year" boundaries are drawn in IST,
   not UTC. The shop is in Tumkur, so a UTC day boundary would misfile every
   application logged between midnight and 5:30am onto the previous day. */
function istPeriods(ref = new Date()) {
  const shifted = new Date(ref.getTime() + IST_OFFSET_MS);

  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();

  // Midnight IST expressed as a UTC instant.
  const dayStart = new Date(Date.UTC(y, m, d) - IST_OFFSET_MS);
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);

  // Week starts Monday.
  const isoDow = (shifted.getUTCDay() + 6) % 7;
  const weekStart = new Date(dayStart.getTime() - isoDow * DAY_MS);

  const monthStart = new Date(Date.UTC(y, m, 1) - IST_OFFSET_MS);
  const yearStart = new Date(Date.UTC(y, 0, 1) - IST_OFFSET_MS);

  return { dayStart, dayEnd, weekStart, monthStart, yearStart };
}

router.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  try {
    const scope = req.session.role === 'admin' ? {} : { staff: req.session.userId };
    const p = istPeriods();

    // Everything is bounded above by the end of today, so a clock-skewed future
    // createdAt cannot leak into "this month" / "this year" totals.
    const day = { createdAt: { $gte: p.dayStart, $lt: p.dayEnd } };
    const week = { createdAt: { $gte: p.weekStart, $lt: p.dayEnd } };
    const month = { createdAt: { $gte: p.monthStart, $lt: p.dayEnd } };
    const year = { createdAt: { $gte: p.yearStart, $lt: p.dayEnd } };

    const count = (range) => [{ $match: { ...scope, ...range } }, { $count: 'v' }];
    const sum = (range, field) => [
      { $match: { ...scope, ...range } },
      { $group: { _id: null, v: { $sum: field } } }
    ];

    const [facets] = await Application.aggregate([
      {
        $facet: {
          applicationsDay: count(day),
          applicationsMonth: count(month),
          applicationsYear: count(year),
          amountDay: sum(day, '$loan.amount'),
          amountWeek: sum(week, '$loan.amount'),
          goldDay: sum(day, '$totalWeightGrams'),
          goldWeek: sum(week, '$totalWeightGrams')
        }
      }
    ]);

    const recent = await Application.find(scope)
      .sort({ createdAt: -1 })
      .limit(RECENT_LIMIT)
      .select('applicationNo status customer.name totalWeightGrams createdAt loan.amount')
      .lean();

    // $count / $group return no row when nothing matches, so normalise to 0.
    const first = (arr) => (Array.isArray(arr) && arr[0] ? arr[0].v : 0);
    const num = (v) => (Number.isFinite(v) ? v : 0);

    res.json({
      scope: req.session.role === 'admin' ? 'all' : 'own',
      applications: {
        day: first(facets.applicationsDay),
        month: first(facets.applicationsMonth),
        year: first(facets.applicationsYear)
      },
      amount: {
        day: num(first(facets.amountDay)),
        week: num(first(facets.amountWeek))
      },
      goldGrams: {
        day: num(first(facets.goldDay)),
        week: num(first(facets.goldWeek))
      },
      recent: recent.map((a) => ({
        id: a._id,
        applicationNo: a.applicationNo,
        customerName: (a.customer && a.customer.name) || '—',
        weightGrams: num(a.totalWeightGrams),
        amount: num(a.loan && a.loan.amount),
        status: a.status,
        createdAt: a.createdAt
      }))
    });
  } catch (err) {
    console.error('Dashboard stats error:', err.message);
    res.status(500).json({ error: 'Could not load dashboard. Please try again.' });
  }
});

router.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: isConnected() ? 'connected' : 'disconnected' });
});

module.exports = router;
