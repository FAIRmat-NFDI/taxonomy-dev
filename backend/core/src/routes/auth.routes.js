import { Router } from 'express';
import { rateLimit } from '../lib/rateLimit.js';
import { requireSession } from '../middleware/requireSession.js';

export function authRoutes(controller, tokens, { registrationRateLimit = 10 } = {}) {
  const router = Router();
  router.get('/providers', controller.listProviders);
  router.post('/session', controller.exchangeHandoff);
  router.post('/password', controller.passwordLogin);
  router.post('/register', rateLimit({ windowMs: 60 * 60_000, max: registrationRateLimit }), controller.register);
  router.post('/github/refresh', controller.refreshGitHub);
  router.get('/me', requireSession(tokens), controller.me);
  router.get('/:provider/login', controller.startLogin);
  router.get('/:provider/callback', controller.callback);
  return router;
}
