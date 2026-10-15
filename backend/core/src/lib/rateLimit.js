import { HttpError } from './httpError.js';

/**
 * Tiny fixed-window rate limit per client IP (in memory, per process).
 * Enough to slow down scripted sign-ups locally / on one dyno; use a shared
 * store (e.g. Redis) if the backend ever runs on many instances.
 */
export function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, _res, next) => {
    const now = Date.now();
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    const entry = hits.get(req.ip);
    if (!entry || entry.reset < now) hits.set(req.ip, { count: 1, reset: now + windowMs });
    else if (++entry.count > max) return next(new HttpError(429, 'too_many_requests', 'Too many attempts. Please try again later.'));
    next();
  };
}
