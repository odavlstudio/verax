const express = require('express');
const path = require('path');
const fs = require('fs');
const { loadConfig } = require('./config');
const { diagnose } = require('../src/doctor-error/engine.js');

const config = loadConfig();

const app = express();
const PORT = parseInt(process.env.PORT || config.PORT, 10);
const MAX_INPUT_CHARS = 20000;
const STRIPE_SECRET_KEY = config.STRIPE_SECRET_KEY;
const NODE_ENV = config.NODE_ENV;
const PRO_PRICE_CENTS = 4900;
const FEEDBACK_LOG = path.join(__dirname, '../data/feedback.log');
const MAX_SIGNATURE_LENGTH = 140;
const MAX_TITLE_LENGTH = 80;
const SERVER_START_TIME = Date.now();

let totalDiagnoses = 0;

// Rate limiting: in-memory IP-based rate limit for /api/diagnose
// Max 30 requests per IP per 10 minutes
const RATE_LIMIT_WINDOW = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX_REQUESTS = 30;
const rateLimitMap = new Map();

function getClientIp(req) {
  return req.ip || req.connection.remoteAddress || 'unknown';
}

function checkRateLimit(clientIp) {
  const now = Date.now();
  let record = rateLimitMap.get(clientIp);

  if (!record) {
    rateLimitMap.set(clientIp, { count: 1, startTime: now });
    return { allowed: true };
  }

  const elapsed = now - record.startTime;

  if (elapsed > RATE_LIMIT_WINDOW) {
    // Window expired, reset
    rateLimitMap.set(clientIp, { count: 1, startTime: now });
    return { allowed: true };
  }

  record.count++;
  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, retryAfter: Math.ceil((RATE_LIMIT_WINDOW - elapsed) / 1000) };
  }

  return { allowed: true };
}

// Cleanup rate limit map every 5 minutes to avoid memory bloat
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now - record.startTime > RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

let stripe = null;
if (STRIPE_SECRET_KEY) {
  try {
    stripe = require('stripe')(STRIPE_SECRET_KEY);
  } catch (err) {
    console.warn('Stripe initialization skipped (key not configured)');
  }
}

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.disable('x-powered-by');
if (NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use(express.json({ limit: '25kb' }));

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large' });
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  return next(err);
});

function isProUser(req) {
  const token = req.headers['x-doctor-pro'] || req.query.pro || '';
  return token === 'test-pro-token' || token === 'pro-token' || token.startsWith('pro_');
}

function trimForFree(diagnosis) {
  if (!diagnosis) return null;
  
  const topCause = diagnosis.rankedCauses?.[0] || null;
  const quickSteps = diagnosis.fixPaths?.quickFix?.steps?.slice(0, 2) || [];

  const response = {
    errorTitle: diagnosis.errorTitle,
    errorSignature: diagnosis.errorSignature,
    confidence: diagnosis.confidence,
    rankedCauses: topCause ? [topCause] : [],
    fixPaths: {
      quickFix: { steps: quickSteps }
    },
    isPro: false
  };

  // Defensive assertion: never expose Pro features to Free users
  if (response.fixPaths.bestFix !== undefined || response.fixPaths.verify !== undefined) {
    console.warn('[SECURITY] Attempted to expose Pro features to Free user');
    delete response.fixPaths.bestFix;
    delete response.fixPaths.verify;
  }
  if (response.diagnosticQuestions !== undefined) {
    console.warn('[SECURITY] Attempted to expose diagnosticQuestions to Free user');
    delete response.diagnosticQuestions;
  }

  return response;
}

function markPro(diagnosis) {
  if (!diagnosis) return null;
  return { ...diagnosis, isPro: true };
}

app.post('/api/diagnose', (req, res) => {
  // Check rate limit
  const clientIp = getClientIp(req);
  const rateLimitCheck = checkRateLimit(clientIp);

  if (!rateLimitCheck.allowed) {
    return res.status(429).json({
      error: 'Too many requests. Please try again later.',
      retryAfter: rateLimitCheck.retryAfter
    });
  }

  // Validate request body type
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Request body must be JSON object' });
  }

  const raw = typeof req.body?.rawErrorText === 'string' ? req.body.rawErrorText : '';
  const trimmed = raw.trim();

  // Validate input: non-empty and minimum length
  if (!trimmed) {
    return res.status(400).json({ error: 'rawErrorText is required' });
  }
  if (trimmed.length < 10) {
    return res.status(400).json({ error: 'rawErrorText must be at least 10 characters' });
  }
  if (trimmed.length > MAX_INPUT_CHARS) {
    return res.status(413).json({ error: `rawErrorText too long (max ${MAX_INPUT_CHARS} chars)` });
  }

  let diagnosis = diagnose(trimmed);

  // If no signature matches, return safe fallback diagnosis
  if (!diagnosis) {
    diagnosis = {
      errorTitle: 'Unknown error',
      errorSignature: 'unknown',
      confidence: 0.1,
      rankedCauses: [],
      fixPaths: {
        quickFix: {
          steps: [
            'The error pattern is not yet recognized by Doctor Error.',
            'Try searching online for the exact error message, or check the official documentation.',
            'If this error is recurring, please provide feedback so we can improve.'
          ]
        }
      },
      safetyNotes: undefined,
      diagnosticQuestions: undefined
    };
  }

  const isPro = isProUser(req);
  const response = isPro ? markPro(diagnosis) : trimForFree(diagnosis);

  // Increment telemetry counter
  totalDiagnoses++;
  
  return res.json({ diagnosis: response });
});

app.get('/health', (req, res) => {
  try {
    const uptime = Math.floor((Date.now() - SERVER_START_TIME) / 1000);
    return res.status(200).json({
      status: 'ok',
      service: 'doctor-error',
      uptime: uptime,
      totalDiagnoses: totalDiagnoses
    });
  } catch (err) {
    // Even if something fails, /health should respond
    return res.status(200).json({
      status: 'ok',
      service: 'doctor-error',
      uptime: 0,
      totalDiagnoses: totalDiagnoses
    });
  }
});

app.post('/api/checkout', async (req, res) => {
  if (!STRIPE_SECRET_KEY || !stripe) {
    return res.status(500).json({ error: 'Stripe not configured. Set STRIPE_SECRET_KEY environment variable.' });
  }
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Doctor Error Pro',
            description: 'Unlock full diagnosis: all causes, best fix, verify steps'
          },
          unit_amount: PRO_PRICE_CENTS
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: `${req.headers.origin || 'http://localhost:3000'}/?pro=pro-token`,
      cancel_url: `${req.headers.origin || 'http://localhost:3000'}/`
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ error: 'Checkout failed' });
  }
});

app.post('/api/feedback', (req, res) => {
  try {
    const { errorSignature, errorTitle, isPro, outcome, timestamp } = req.body;

    if (!errorSignature || typeof errorSignature !== 'string' || errorSignature.length > MAX_SIGNATURE_LENGTH) {
      return res.status(400).json({ error: 'Invalid errorSignature' });
    }
    if (!errorTitle || typeof errorTitle !== 'string' || errorTitle.length > MAX_TITLE_LENGTH) {
      return res.status(400).json({ error: 'Invalid errorTitle' });
    }
    if (typeof isPro !== 'boolean') {
      return res.status(400).json({ error: 'Invalid isPro' });
    }
    if (!outcome || !['worked', 'didnt_work'].includes(outcome)) {
      return res.status(400).json({ error: 'Invalid outcome' });
    }
    if (!timestamp || typeof timestamp !== 'number') {
      return res.status(400).json({ error: 'Invalid timestamp' });
    }

    const entry = JSON.stringify({
      errorSignature,
      errorTitle,
      isPro,
      outcome,
      timestamp,
      recordedAt: Date.now()
    });

    fs.appendFile(FEEDBACK_LOG, entry + '\n', (err) => {
      if (err) {
        console.error('Failed to write feedback:', err);
      }
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('Feedback error:', err);
    return res.status(500).json({ error: 'Failed to record feedback' });
  }
});

app.get('/api/feedback/stats', (req, res) => {
  try {
    if (!fs.existsSync(FEEDBACK_LOG)) {
      return res.json({ total: 0, bySignature: {}, byOutcome: {}, byPro: {} });
    }

    const lines = fs.readFileSync(FEEDBACK_LOG, 'utf8').split('\n').filter(Boolean);
    const entries = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);

    const stats = {
      total: entries.length,
      bySignature: {},
      byOutcome: { worked: 0, didnt_work: 0 },
      byPro: { free: 0, pro: 0 }
    };

    entries.forEach(entry => {
      const sig = entry.errorSignature || 'unknown';
      stats.bySignature[sig] = (stats.bySignature[sig] || 0) + 1;
      stats.byOutcome[entry.outcome] = (stats.byOutcome[entry.outcome] || 0) + 1;
      stats.byPro[entry.isPro ? 'pro' : 'free'] += 1;
    });

    return res.json(stats);
  } catch (err) {
    console.error('Stats error:', err);
    return res.status(500).json({ error: 'Failed to read stats' });
  }
});

const publicDir = path.join(__dirname, 'public');
const sitemapPath = path.join(publicDir, 'sitemap.xml');

// Explicit sitemap route to ensure Google gets XML, not the SPA shell
app.get('/sitemap.xml', (req, res) => {
  try {
    const xml = fs.readFileSync(sitemapPath, 'utf8');
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send(xml);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return res.status(404).send('Sitemap not found');
    }
    console.error('Sitemap serving error:', err);
    return res.status(500).send('Internal error');
  }
});

app.use(express.static(publicDir));

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Global error handler: catch any uncaught errors and return 500
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message || err);
  if (NODE_ENV === 'production') {
    return res.status(500).json({ error: 'Internal diagnosis failure' });
  }
  return res.status(500).json({
    error: 'Internal diagnosis failure',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`Doctor Error web UI running at http://localhost:${PORT}`);
});
