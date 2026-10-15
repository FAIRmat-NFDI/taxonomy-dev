import { HttpError } from '../lib/httpError.js';

/** Requires `Authorization: Bearer <session token>`; puts the claims on req.session. */
export function requireSession(tokens) {
  return (req, _res, next) => {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) return next(new HttpError(401, 'unauthenticated', 'Sign in first.'));
    req.session = tokens.verifySession(token);
    next();
  };
}
