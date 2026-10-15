/**
 * CORS for the configured frontend origins only. Auth uses Bearer tokens (no
 * cross-site cookies), so the frontend and this API can live on any domains.
 */
export function cors(allowedOrigins) {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin.toLowerCase())) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, X-GitHub-Api-Version');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    res.append('Vary', 'Origin');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  };
}
