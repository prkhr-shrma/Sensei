import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { getProgress, saveProgress } from './db.js';

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

// ── Progress persistence (SQLite via db.js)
app.get('/api/progress', (_req, res) => {
  try { res.json(getProgress()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/progress', (req, res) => {
  const token = process.env.PROGRESS_TOKEN;
  if (token && req.headers['x-progress-token'] !== token)
    return res.status(401).json({ error: 'Unauthorized.' });
  try { saveProgress(req.body); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

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

// ── Code runner: sandboxed Python execution (5s timeout)
app.post('/api/run', (req, res) => {
  const { code, stdin = '' } = req.body;
  if (!code || typeof code !== 'string') return res.status(400).json({ error: 'code required.' });
  if (code.length > 8000) return res.status(400).json({ error: 'Code too large.' });

  // Wrap user code so it runs as a script; stdin feeds test input
  const script = code;
  const python = process.platform === 'win32' ? 'python' : 'python3';
  const child = spawn(python, ['-c', script], {
    timeout: 5000,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });

  let stdout = '', stderr = '';
  child.stdout.on('data', d => { stdout += d; if (stdout.length > 4000) child.kill(); });
  child.stderr.on('data', d => { stderr += d; if (stderr.length > 2000) child.kill(); });
  if (stdin) child.stdin.write(stdin);
  child.stdin.end();

  child.on('close', (code) => {
    res.json({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code });
  });
  child.on('error', err => {
    res.status(500).json({ error: err.message });
  });
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
