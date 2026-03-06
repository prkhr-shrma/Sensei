// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';

// ── Stub fetch before importing the app ──────────────────────
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ── Set env before app import ────────────────────────────────
process.env.ANTHROPIC_API_KEY = 'test-key-123';
process.env.NODE_ENV = 'test';

const { app } = await import('./server.js');

const VALID_BODY = {
  model: 'claude-sonnet-4-6',
  max_tokens: 80,
  system: 'You are Sensei.',
  messages: [{ role: 'user', content: 'Hello' }],
};

const ANTHROPIC_OK = {
  id: 'msg_test',
  content: [{ type: 'text', text: 'What is your brute force?' }],
};

beforeEach(() => {
  mockFetch.mockResolvedValue({
    status: 200,
    json: async () => ANTHROPIC_OK,
  });
});

afterEach(() => vi.clearAllMocks());

// ─── Happy path ───────────────────────────────────────────────
describe('POST /api/messages — happy path', () => {
  it('proxies to Anthropic and returns 200', async () => {
    const res = await request(app).post('/api/messages').send(VALID_BODY);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject(ANTHROPIC_OK);
  });

  it('calls Anthropic with the correct headers', async () => {
    await request(app).post('/api/messages').send(VALID_BODY);
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['x-api-key']).toBe('test-key-123');
    expect(opts.headers['anthropic-version']).toBe('2023-06-01');
  });

  it('strips x-api-key from the forwarded body', async () => {
    await request(app).post('/api/messages').send(VALID_BODY);
    const [, opts] = mockFetch.mock.calls[0];
    const forwarded = JSON.parse(opts.body);
    expect(forwarded['x-api-key']).toBeUndefined();
  });

  it('caps max_tokens at 500', async () => {
    await request(app)
      .post('/api/messages')
      .send({ ...VALID_BODY, max_tokens: 9999 });
    const [, opts] = mockFetch.mock.calls[0];
    expect(JSON.parse(opts.body).max_tokens).toBe(500);
  });

  it('has security headers from helmet', async () => {
    const res = await request(app).post('/api/messages').send(VALID_BODY);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });
});

// ─── Input validation ─────────────────────────────────────────
describe('POST /api/messages — validation', () => {
  it('rejects disallowed model with 400', async () => {
    const res = await request(app)
      .post('/api/messages')
      .send({ ...VALID_BODY, model: 'gpt-4o' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not allowed/i);
  });

  it('rejects missing model with 400', async () => {
    const { model: _, ...body } = VALID_BODY;
    const res = await request(app).post('/api/messages').send(body);
    expect(res.status).toBe(400);
  });

  it('rejects empty messages array with 400', async () => {
    const res = await request(app)
      .post('/api/messages')
      .send({ ...VALID_BODY, messages: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/non-empty/i);
  });

  it('rejects non-array messages with 400', async () => {
    const res = await request(app)
      .post('/api/messages')
      .send({ ...VALID_BODY, messages: 'hello' });
    expect(res.status).toBe(400);
  });

  it('rejects body larger than 16 KB with 413', async () => {
    const bigPayload = { ...VALID_BODY, system: 'x'.repeat(20 * 1024) };
    const res = await request(app).post('/api/messages').send(bigPayload);
    expect(res.status).toBe(413);
  });
});

// ─── Missing API key ──────────────────────────────────────────
describe('POST /api/messages — missing API key', () => {
  it('returns 500 when ANTHROPIC_API_KEY is not set', async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const res = await request(app).post('/api/messages').send(VALID_BODY);
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/not configured/i);

    process.env.ANTHROPIC_API_KEY = original;
  });
});

// ─── Upstream error ───────────────────────────────────────────
describe('POST /api/messages — upstream failure', () => {
  it('returns 502 when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const res = await request(app).post('/api/messages').send(VALID_BODY);
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/Anthropic/i);
  });
});

// ─── Rate limiting ────────────────────────────────────────────
describe('rate limiting', () => {
  it('returns 429 after 60 rapid requests', async () => {
    const results = await Promise.all(
      Array.from({ length: 61 }, () =>
        request(app).post('/api/messages').send(VALID_BODY)
      )
    );
    const tooMany = results.filter(r => r.status === 429);
    expect(tooMany.length).toBeGreaterThan(0);
  });
});
