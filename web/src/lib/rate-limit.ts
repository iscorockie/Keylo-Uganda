/**
 * Minimal in-memory rate limiter for login (brute-force protection).
 *
 * Keyed by a combination of email + client IP. In-memory is fine for this
 * single-instance Node server; a production deployment should back this with
 * Redis or a shared store so limits hold across replicas.
 */

type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

// Sweep expired buckets occasionally to avoid unbounded growth.
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, e] of buckets) {
    if (e.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Record one attempt. Returns `true` if the attempt is allowed, `false` if the
 * limit has been exceeded (caller should return 429).
 */
export function rateLimit(key: string, maxAttempts = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  sweep(now);

  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  entry.count += 1;
  return entry.count <= maxAttempts;
}

/** Clear the bucket for a key (e.g. after a successful login). */
export function clearRateLimit(key: string) {
  buckets.delete(key);
}
