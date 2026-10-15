import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { HttpError } from '../lib/httpError.js';

/**
 * Two primitives, both stateless (safe with several instances):
 *  - session tokens: HS256 JWTs the frontend sends as `Authorization: Bearer …`
 *    for proxy (on-behalf-of) calls;
 *  - sealed blobs: AES-256-GCM encrypted JSON with an expiry, used for the
 *    OAuth state cookie and the one-time login hand-off to the frontend.
 */
export function createTokenService(secret, sessionTtlSeconds) {
  const derive = (purpose) => createHash('sha256').update(`${purpose}:${secret}`).digest();
  const signKey = derive('session-jwt');
  const sealKey = derive('seal');
  const nowSeconds = () => Math.floor(Date.now() / 1000);

  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const hmac = (data) => createHmac('sha256', signKey).update(data).digest('base64url');

  function signSession(claims) {
    const iat = nowSeconds();
    const head = b64({ alg: 'HS256', typ: 'JWT' });
    const body = b64({ ...claims, iat, exp: iat + sessionTtlSeconds });
    return `${head}.${body}.${hmac(`${head}.${body}`)}`;
  }

  function verifySession(token) {
    const [head, body, sig] = String(token ?? '').split('.');
    if (!head || !body || !sig) throw new HttpError(401, 'invalid_token', 'Malformed session token.');
    const expected = Buffer.from(hmac(`${head}.${body}`));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      throw new HttpError(401, 'invalid_token', 'Session token signature is invalid.');
    }
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof claims.exp !== 'number' || claims.exp < nowSeconds()) {
      throw new HttpError(401, 'session_expired', 'Session expired. Please sign in again.');
    }
    return claims;
  }

  function seal(payload, ttlSeconds) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', sealKey, iv);
    const data = Buffer.concat([cipher.update(JSON.stringify({ p: payload, e: nowSeconds() + ttlSeconds })), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
  }

  function unseal(sealed) {
    try {
      const raw = Buffer.from(String(sealed), 'base64url');
      const decipher = createDecipheriv('aes-256-gcm', sealKey, raw.subarray(0, 12));
      decipher.setAuthTag(raw.subarray(12, 28));
      const { p, e } = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8'));
      if (e < nowSeconds()) throw new Error('expired');
      return p;
    } catch {
      throw new HttpError(400, 'invalid_or_expired', 'Sign-in data is invalid or expired. Please try again.');
    }
  }

  return { signSession, verifySession, seal, unseal, sessionTtlSeconds };
}
