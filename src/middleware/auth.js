const requireAuth = (req, res, next) => {
  if (req.session && req.session.userId) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.redirect('/login');
};

const requireAdmin = (req, res, next) => {
  if (req.session && req.session.role === 'admin') return next();
  return res.status(403).json({ error: 'Forbidden' });
};

module.exports = { requireAuth, requireAdmin };