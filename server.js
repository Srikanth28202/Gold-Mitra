const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { connectDB } = require('./src/config/db');
const { router: authRoutes, bootstrapAdmin } = require('./src/routes/auth');
const dashboardRoutes = require('./src/routes/dashboard');
const applicationRoutes = require('./src/routes/applications');
const staffRoutes = require('./src/routes/staff');
const { requireAuth } = require('./src/middleware/auth');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = () => process.env.NODE_ENV === 'production';

/* ─────────────────────────────────────────────────────────────
   Trust proxy so secure cookies + req.ip work behind Vercel/nginx.
   (trust proxy is intentionally set before session + rate limiter)
   ───────────────────────────────────────────────────────────── */
app.set('trust proxy', 1);

/* ─────────────────────────────────────────────────────────────
   Security headers (helmet). CSP intentionally left disabled for
   this no-build vanilla app (inline styles, Google Fonts, data-URL
   images). See README "Remaining issues".
   ───────────────────────────────────────────────────────────── */
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

/* ─────────────────────────────────────────────────────────────
   Body parsing. Base64 photo data URLs keep the JSON payload in
   the 1–4 MB range after client-side compression; 8 MB headroom.
   ───────────────────────────────────────────────────────────── */
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '8mb' }));

/* ─────────────────────────────────────────────────────────────
   Sessions. Production requires a real secret; cookie flags:
   httpOnly + SameSite=Lax (CSRF mitigation) + Secure in prod.
   ───────────────────────────────────────────────────────────── */
const sessionSecret = process.env.SESSION_SECRET;
const configError =
  isProduction() && (!sessionSecret || sessionSecret.length < 24)
    ? 'SESSION_SECRET must be set to at least 24 characters in production.'
    : null;

if (configError && require.main === module) {
  console.error('Set a strong SESSION_SECRET (≥24 chars) before running in production.');
  throw new Error(configError);
}

/* Serverless (Vercel) cold starts can crash with an unhelpful 500 if the
   module throws at load. Instead, answer every request with a clear error
   until the environment is configured correctly. */
if (configError) {
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(500).json({ error: configError });
    }
    res.status(500).type('html').send(
      `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Gold Mitra · Not configured</title></head><body style="font-family:system-ui;background:#0A0F1C;color:#E8E6E1;display:grid;place-items:center;min-height:100dvh;margin:0;text-align:center;padding:24px"><div style="max-width:440px"><h1 style="color:#D4AF37;margin:0 0 8px">Server not configured</h1><p style="color:#8B93A3;margin:0">${configError}<br/><br/>Add it to your Vercel <b>Environment Variables</b> and redeploy.</p></div></body></html>`
    );
  });
  module.exports = app;
  return;
}

app.use(
  session({
    secret: sessionSecret || 'gold-mithra-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction(),
      maxAge: parseInt(process.env.SESSION_MAX_AGE_MS || '86400000', 10)
    }
  })
);

/* ─────────────────────────────────────────────────────────────
   CSRF defense: state-changing requests must be same-origin.
   Browsers send an Origin header on cross-site requests; reject
   when it does not match the Host. (Non-browser clients without
   an Origin header are unaffected.)
   ───────────────────────────────────────────────────────────── */
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    } catch (_) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  next();
});

/* ─────────────────────────────────────────────────────────────
   Login brute-force protection (in-memory sliding window).
   Fine for single-instance and small deployments; note in README
   for multi-instance scaling.
   ───────────────────────────────────────────────────────────── */
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

/* Periodically drop expired rate-limit entries so the map stays bounded. */
setInterval(() => {
  const now = Date.now();
  for (const [key, rec] of loginAttempts) {
    if (now > rec.resetAt) loginAttempts.delete(key);
  }
}, LOGIN_WINDOW_MS).unref();

app.use('/api/auth/login', (req, res, next) => {
  if (req.method !== 'POST') return next();

  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let record = loginAttempts.get(key);

  if (!record || now > record.resetAt) {
    record = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
    loginAttempts.set(key, record);
  }

  if (record.count >= LOGIN_MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'Too many attempts. Please try again in 15 minutes.' });
  }

  res.on('finish', () => {
    if (res.statusCode === 401) record.count += 1;
  });

  next();
});

/* ─────────────────────────────────────────────────────────────
   Lazy database connection for serverless (Vercel) and any
   non-served entry point. First API request on a cold instance
   opens the (cached) connection and ensures the bootstrap admin.
   ───────────────────────────────────────────────────────────── */
let adminBootstrapped = false;

app.use('/api', async (req, res, next) => {
  if (!process.env.MONGODB_URI) {
    return res
      .status(503)
      .json({ error: 'Database not configured. Set MONGODB_URI in your environment.' });
  }
  if (mongoose.connection.readyState !== 1) {
    const ok = await connectDB();
    if (!ok && mongoose.connection.readyState !== 1) {
      return res
        .status(503)
        .json({ error: 'Database unavailable. Check the MONGODB_URI / Atlas connection and try again.' });
    }
    if (ok && !adminBootstrapped) {
      adminBootstrapped = true;
      await bootstrapAdmin();
    }
  }
  next();
});

/* ─────────────────────────────────────────────────────────────
   Routes & static
   ───────────────────────────────────────────────────────────── */
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/applications/new', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'application.html'));
});

app.get('/applications/:id/edit', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'application.html'));
});

app.get('/records', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'records.html'));
});

app.get('/records/:id/print', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'record-print.html'));
});

app.get('/records/:id', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'record.html'));
});

app.get('/settings', requireAuth, (req, res) => {
  if (req.session.role !== 'admin') return res.redirect('/');
  res.sendFile(path.join(__dirname, 'views', 'settings.html'));
});

app.use(authRoutes);
app.use(dashboardRoutes);
app.use(applicationRoutes);
app.use(staffRoutes);

/* ─────────────────────────────────────────────────────────────
   Missing-route handling (API 404 JSON, pages redirect home)
   ───────────────────────────────────────────────────────────── */
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res
    .status(404)
    .type('html')
    .send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>404 · Gold Mitra</title><style>body{font-family:system-ui,sans-serif;background:#0A0F1C;color:#E8E6E1;display:grid;place-items:center;min-height:100dvh;margin:0;text-align:center}div{max-width:420px;padding:24px}h1{color:#D4AF37;margin:0 0 8px}p{color:#8B93A3;margin:0 0 24px}a{color:#D4AF37}</style></head><body><div><h1>404</h1><p>The page you're looking for doesn't exist.</p><a href="/">← Back to Dashboard</a></div></body></html>`);
});

/* ─────────────────────────────────────────────────────────────
   Local / persistent-process entry point
   ───────────────────────────────────────────────────────────── */
const start = async () => {
  await connectDB();
  if (!adminBootstrapped) {
    adminBootstrapped = true;
    try {
      await bootstrapAdmin();
    } catch (err) {
      console.warn('Bootstrap skipped:', err.message);
    }
  }

  const server = app.listen(PORT, () => {
    console.log(`☀️  Gold Mitra server ready on port ${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`✗ Port ${PORT} is already in use.`);
      console.error('  Another Gold Mitra (or stray node) process may still be running.');
      console.error('  → Stop it with:  Get-Process node | Stop-Process -Force');
      console.error('  → Or pick another port: set PORT before starting.');
    } else if (err.code === 'EACCES') {
      console.error(`✗ No permission to bind port ${PORT}. Use a port above 1024.`);
    } else {
      console.error('✗ Server failed to start:', err.message);
    }
    process.exit(1);
  });

  return server;
};

if (require.main === module) {
  start().catch((err) => {
    console.error('✗ Failed to start Gold Mitra:', err);
    process.exit(1);
  });
}

module.exports = app; // Vercel serverless entry