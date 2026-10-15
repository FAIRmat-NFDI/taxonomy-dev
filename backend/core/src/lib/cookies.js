/** Minimal cookie helpers (no cookie-parser dependency). */
export function readCookie(req, name) {
  const header = req.headers.cookie ?? '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function setCookie(res, name, value, { maxAgeSeconds, path = '/', secure = false } = {}) {
  const attrs = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, 'HttpOnly', 'SameSite=Lax'];
  if (maxAgeSeconds !== undefined) attrs.push(`Max-Age=${maxAgeSeconds}`);
  if (secure) attrs.push('Secure');
  res.append('Set-Cookie', attrs.join('; '));
}

export function clearCookie(res, name, { path = '/', secure = false } = {}) {
  setCookie(res, name, '', { maxAgeSeconds: 0, path, secure });
}
