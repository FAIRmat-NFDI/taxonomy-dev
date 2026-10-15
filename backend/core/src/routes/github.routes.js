import { Router } from 'express';
import { requireSession } from '../middleware/requireSession.js';

/** Mounted at /github — same sub-paths as https://api.github.com (allowlist in services/githubProxy.js). */
export function githubRoutes(controller, tokens) {
  const router = Router();
  router.use(requireSession(tokens), controller.proxy);
  return router;
}
