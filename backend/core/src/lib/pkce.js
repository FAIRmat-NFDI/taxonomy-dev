import { createHash, randomBytes } from 'node:crypto';

/** Random URL-safe string (state, nonce, PKCE verifier). */
export const randomUrlSafe = (bytes = 32) => randomBytes(bytes).toString('base64url');

/** PKCE S256 challenge for a verifier (RFC 7636). */
export const codeChallengeS256 = (verifier) => createHash('sha256').update(verifier).digest('base64url');
