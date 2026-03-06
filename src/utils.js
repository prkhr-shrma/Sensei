export const DECAY_PER_DAY = 12;
export const REV_THRESHOLD = 70;
export const XPV = { Easy: 10, Medium: 25, Hard: 50 };

export function getConfidence(history, pid) {
  const h = history[pid];
  if (!h) return null;
  const daysSince = Math.floor((Date.now() - (h.lastRevised || h.firstSolved)) / 86400000);
  return Math.max(0, 100 - daysSince * DECAY_PER_DAY);
}

export function fluencyColor(conf) {
  if (conf === null) return null;
  if (conf >= 80) return "#4ade80";
  if (conf >= 50) return "#fbbf24";
  return "#f87171";
}

export function fluencyLabel(conf) {
  if (conf === null) return null;
  if (conf >= 80) return "fresh";
  if (conf >= 50) return "stale";
  return "due";
}

export function buildPrompt(prob, isRevision) {
  if (isRevision) {
    return `You are Sensei. Student is in COLD REVISION for "${prob.title}". Say nothing unless asked. If asked: "Revision mode — prove you know it cold." If they submit: check correctness silently, then only ask complexity. No hints ever.`;
  }
  return `You are Sensei, a DSA coach. RULES: MAX 2 sentences. Never write code. Never reveal the solution. Ask ONE question. Wrong direction? Give a tricky input that exposes the flaw. Correct? Ask "time complexity?" or "space complexity?". Unknown concept? Name it + one sentence def. Solved? Say "✓" + key insight ≤10 words. PROBLEM: ${prob.title} (${prob.diff}) | Pattern: ${prob.pat}\n${prob.desc}`;
}

export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export const dayType = () => {
  const d = new Date().getDay();
  return d === 0 || d === 6 ? 'revision' : 'practice';
};

export const dayName = () =>
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
