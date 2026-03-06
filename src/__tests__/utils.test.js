import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DECAY_PER_DAY,
  REV_THRESHOLD,
  XPV,
  getConfidence,
  fluencyColor,
  fluencyLabel,
  buildPrompt,
  todayKey,
  dayType,
  dayName,
} from '../utils.js';

// ─── Constants ────────────────────────────────────────────────
describe('constants', () => {
  it('DECAY_PER_DAY is 12', () => expect(DECAY_PER_DAY).toBe(12));
  it('REV_THRESHOLD is 70', () => expect(REV_THRESHOLD).toBe(70));
  it('XPV has correct values', () => {
    expect(XPV.Easy).toBe(10);
    expect(XPV.Medium).toBe(25);
    expect(XPV.Hard).toBe(50);
  });
});

// ─── getConfidence ────────────────────────────────────────────
describe('getConfidence', () => {
  const now = new Date('2024-06-15T12:00:00Z').getTime();

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns null when no history for pid', () => {
    expect(getConfidence({}, 1)).toBeNull();
  });

  it('returns 100 when solved right now', () => {
    vi.setSystemTime(now);
    const history = { 1: { firstSolved: now, lastRevised: now } };
    expect(getConfidence(history, 1)).toBe(100);
  });

  it('decays by DECAY_PER_DAY per day', () => {
    vi.setSystemTime(now + 2 * 86400000); // 2 days later
    const history = { 1: { firstSolved: now, lastRevised: now } };
    expect(getConfidence(history, 1)).toBe(100 - 2 * DECAY_PER_DAY);
  });

  it('uses lastRevised over firstSolved', () => {
    const revised = now + 3 * 86400000;
    vi.setSystemTime(revised + 86400000); // 1 day after revision
    const history = { 1: { firstSolved: now, lastRevised: revised } };
    expect(getConfidence(history, 1)).toBe(100 - DECAY_PER_DAY);
  });

  it('floors at 0, never negative', () => {
    vi.setSystemTime(now + 20 * 86400000); // 20 days — would go below 0
    const history = { 1: { firstSolved: now, lastRevised: now } };
    expect(getConfidence(history, 1)).toBe(0);
  });
});

// ─── fluencyColor ─────────────────────────────────────────────
describe('fluencyColor', () => {
  it('returns null for null confidence', () => expect(fluencyColor(null)).toBeNull());
  it('returns green for conf >= 80', () => expect(fluencyColor(80)).toBe('#4ade80'));
  it('returns green for conf 100', () => expect(fluencyColor(100)).toBe('#4ade80'));
  it('returns yellow for conf 50-79', () => {
    expect(fluencyColor(50)).toBe('#fbbf24');
    expect(fluencyColor(79)).toBe('#fbbf24');
  });
  it('returns red for conf < 50', () => {
    expect(fluencyColor(49)).toBe('#f87171');
    expect(fluencyColor(0)).toBe('#f87171');
  });
});

// ─── fluencyLabel ─────────────────────────────────────────────
describe('fluencyLabel', () => {
  it('returns null for null confidence', () => expect(fluencyLabel(null)).toBeNull());
  it('returns "fresh" for conf >= 80', () => expect(fluencyLabel(80)).toBe('fresh'));
  it('returns "stale" for conf 50-79', () => expect(fluencyLabel(65)).toBe('stale'));
  it('returns "due" for conf < 50', () => expect(fluencyLabel(30)).toBe('due'));
});

// ─── buildPrompt ──────────────────────────────────────────────
describe('buildPrompt', () => {
  const prob = {
    title: 'Two Sum',
    diff: 'Easy',
    pat: 'Hash Map',
    desc: 'Given nums and target, return indices.',
  };

  it('practice prompt contains problem title', () => {
    const p = buildPrompt(prob, false);
    expect(p).toContain('Two Sum');
  });

  it('practice prompt contains pattern', () => {
    expect(buildPrompt(prob, false)).toContain('Hash Map');
  });

  it('practice prompt contains difficulty', () => {
    expect(buildPrompt(prob, false)).toContain('Easy');
  });

  it('practice prompt contains Sensei rules', () => {
    expect(buildPrompt(prob, false)).toContain('MAX 2 sentences');
  });

  it('revision prompt mentions COLD REVISION', () => {
    expect(buildPrompt(prob, true)).toContain('COLD REVISION');
  });

  it('revision prompt contains problem title', () => {
    expect(buildPrompt(prob, true)).toContain('Two Sum');
  });

  it('revision prompt says no hints', () => {
    expect(buildPrompt(prob, true)).toContain('No hints ever');
  });
});

// ─── todayKey ─────────────────────────────────────────────────
describe('todayKey', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns a string', () => {
    vi.setSystemTime(new Date('2024-06-15'));
    expect(typeof todayKey()).toBe('string');
  });

  it('includes the year', () => {
    vi.setSystemTime(new Date('2024-06-15'));
    expect(todayKey()).toContain('2024');
  });

  it('changes on a new day', () => {
    vi.setSystemTime(new Date('2024-06-15'));
    const day1 = todayKey();
    vi.setSystemTime(new Date('2024-06-16'));
    expect(todayKey()).not.toBe(day1);
  });
});

// ─── dayType ──────────────────────────────────────────────────
describe('dayType', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns "practice" on Monday', () => {
    vi.setSystemTime(new Date('2024-06-17')); // Monday
    expect(dayType()).toBe('practice');
  });

  it('returns "practice" on Friday', () => {
    vi.setSystemTime(new Date('2024-06-21')); // Friday
    expect(dayType()).toBe('practice');
  });

  it('returns "revision" on Saturday', () => {
    vi.setSystemTime(new Date('2024-06-22')); // Saturday
    expect(dayType()).toBe('revision');
  });

  it('returns "revision" on Sunday', () => {
    vi.setSystemTime(new Date('2024-06-23')); // Sunday
    expect(dayType()).toBe('revision');
  });
});

// ─── dayName ──────────────────────────────────────────────────
describe('dayName', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns "Mon" on Monday', () => {
    vi.setSystemTime(new Date('2024-06-17'));
    expect(dayName()).toBe('Mon');
  });

  it('returns "Sun" on Sunday', () => {
    vi.setSystemTime(new Date('2024-06-23'));
    expect(dayName()).toBe('Sun');
  });

  it('returns "Sat" on Saturday', () => {
    vi.setSystemTime(new Date('2024-06-22'));
    expect(dayName()).toBe('Sat');
  });
});
