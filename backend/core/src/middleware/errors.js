import { HttpError } from '../lib/httpError.js';

export function notFound(req, _res, next) {
  next(new HttpError(404, 'not_found', `${req.method} ${req.path} does not exist.`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.code, message: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json', message: 'Request body is not valid JSON.' });
  console.error(err);
  res.status(500).json({ error: 'internal_error', message: 'Something went wrong.' });
}
