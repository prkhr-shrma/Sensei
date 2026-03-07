import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { getProgress, saveProgress, upsertUser, getUserByGithubId } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-6',
  'claude-sonnet-4-20250514',
  'claude-haiku-4-5-20251001',
  'claude-opus-4-6',
]);
const MAX_TOKENS_CAP = 500;

export const app = express();

// ── Security headers (relax CSP for GitHub avatar images)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'img-src': ["'self'", 'data:', 'https://avatars.githubusercontent.com'],
    },
  },
}));

// ── Session (must come before passport)
app.use(session({
  secret: process.env.SESSION_SECRET || 'sensei-dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
}));

// ── Passport
passport.use(new GitHubStrategy(
  {
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.GITHUB_CALLBACK_URL || '/auth/github/callback',
  },
  (_accessToken, _refreshToken, profile, done) => {
    const user = {
      id: `gh_${profile.id}`,
      githubId: profile.id,
      username: profile.username,
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };
    upsertUser(user);
    done(null, user);
  }
));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  // id is already the full user_id string stored in session
  // We reconstruct minimal user from the id (githubId embedded)
  const githubId = id.replace(/^gh_/, '');
  const row = getUserByGithubId(githubId);
  if (!row) return done(null, false);
  done(null, { id: row.id, githubId: row.github_id, username: row.username, avatarUrl: row.avatar_url });
});

app.use(passport.initialize());
app.use(passport.session());

// ── Rate limiting
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down.' },
}));

// ── Body parsing
app.use(express.json({ limit: '16kb' }));

// ── Auth middleware helper
const requireAuth = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Not authenticated.' });
};

// ── Auth routes ───────────────────────────────────────────────

app.get('/auth/github',
  passport.authenticate('github', { scope: ['read:user'] })
);

app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/?auth=failed' }),
  (_req, res) => res.redirect('/')
);

app.get('/api/me', (req, res) => {
  if (!req.isAuthenticated()) return res.json({ user: null });
  const { id, username, avatarUrl } = req.user;
  res.json({ user: { id, username, avatarUrl } });
});

app.post('/api/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    res.json({ ok: true });
  });
});

// ── Progress (per-user, auth required) ───────────────────────

app.get('/api/progress', requireAuth, (req, res) => {
  try { res.json(getProgress(req.user.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/progress', requireAuth, (req, res) => {
  // Legacy token check kept for backward-compat during transition
  const token = process.env.PROGRESS_TOKEN;
  if (token && req.headers['x-progress-token'] !== token && !req.isAuthenticated())
    return res.status(401).json({ error: 'Unauthorized.' });
  try { saveProgress(req.body, req.user.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Health check
app.get('/api/health', (_req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  const ghConfigured = !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
  res.json({ ok: !!key, keyLoaded: !!key, githubSso: ghConfigured });
});

// ── Claude proxy (auth required)
app.post('/api/messages', requireAuth, async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured.' });

  const { model, max_tokens, system, messages } = req.body;

  if (!model || !ALLOWED_MODELS.has(model))
    return res.status(400).json({ error: `Model not allowed. Use one of: ${[...ALLOWED_MODELS].join(', ')}` });

  if (!Array.isArray(messages) || messages.length === 0)
    return res.status(400).json({ error: 'messages must be a non-empty array.' });

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
  } catch {
    res.status(502).json({ error: 'Failed to reach Anthropic API.' });
  }
});

// ── Code runner (auth required)
app.post('/api/run', requireAuth, (req, res) => {
  const { code, stdin = '' } = req.body;
  if (!code || typeof code !== 'string') return res.status(400).json({ error: 'code required.' });
  if (code.length > 8000) return res.status(400).json({ error: 'Code too large.' });

  const python = process.platform === 'win32' ? 'python' : 'python3';
  const child = spawn(python, ['-c', code], {
    timeout: 5000,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });

  let stdout = '', stderr = '';
  child.stdout.on('data', d => { stdout += d; if (stdout.length > 4000) child.kill(); });
  child.stderr.on('data', d => { stderr += d; if (stderr.length > 2000) child.kill(); });
  if (stdin) child.stdin.write(stdin);
  child.stdin.end();

  child.on('close', (code) => res.json({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code }));
  child.on('error', err => res.status(500).json({ error: err.message }));
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
