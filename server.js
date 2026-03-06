import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-6',
  'claude-sonnet-4-20250514',
  'claude-haiku-4-5-20251001',
  'claude-opus-4-6',
]);
const MAX_TOKENS_CAP = 500;

export const app = express();

// ── Security headers
app.use(helmet());

// ── Rate limiting: 60 requests/minute per IP
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down.' },
}));

// ── Body parsing with 16 KB cap
app.use(express.json({ limit: '16kb' }));

// ── Anthropic proxy
// ── Health check: verify key is loaded (never exposes the key)
app.get('/api/health', (_req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  res.json({ ok: !!key, keyLoaded: !!key, hint: key ? undefined : 'Set ANTHROPIC_API_KEY in .env' });
});

app.post('/api/messages', async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured.' });

  const { model, max_tokens, system, messages } = req.body;

  // Validate model
  if (!model || !ALLOWED_MODELS.has(model)) {
    return res.status(400).json({ error: `Model not allowed. Use one of: ${[...ALLOWED_MODELS].join(', ')}` });
  }

  // Validate messages array
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array.' });
  }

  // Cap max_tokens
  const tokens = Math.min(Number(max_tokens) || 100, MAX_TOKENS_CAP);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens: tokens, system, messages }),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach Anthropic API.' });
  }
});

// ── Serve Vite build in production
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ── Start (skipped during tests)
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`sensei server on http://localhost:${PORT}`));
}
