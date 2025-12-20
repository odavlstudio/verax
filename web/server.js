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

let stripe = null;
try {
  stripe = require('stripe')(STRIPE_SECRET_KEY);
} catch (err) {
  throw new Error('Stripe initialization failed. Check STRIPE_SECRET_KEY.');
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

  return {
    errorTitle: diagnosis.errorTitle,
    errorSignature: diagnosis.errorSignature,
    confidence: diagnosis.confidence,
    rankedCauses: topCause ? [topCause] : [],
    fixPaths: {
      quickFix: { steps: quickSteps }
    },
    isPro: false
  };
}

function markPro(diagnosis) {
  if (!diagnosis) return null;
  return { ...diagnosis, isPro: true };
}

app.post('/api/diagnose', (req, res) => {
  const raw = typeof req.body?.rawErrorText === 'string' ? req.body.rawErrorText : '';
  const trimmed = raw.trim();

  if (!trimmed) {
    return res.status(400).json({ error: 'rawErrorText is required' });
  }
  if (trimmed.length > MAX_INPUT_CHARS) {
    return res.status(413).json({ error: `rawErrorText too long (max ${MAX_INPUT_CHARS} chars)` });
  }

  const diagnosis = diagnose(trimmed);
  
  const isPro = isProUser(req);
  const response = isPro ? markPro(diagnosis) : trimForFree(diagnosis);
  
  return res.json({ diagnosis: response });
});

app.post('/api/checkout', async (req, res) => {
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
app.use(express.static(publicDir));

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Doctor Error web UI running at http://localhost:${PORT}`);
});
