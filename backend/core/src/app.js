import express from 'express';
import { createAuthController } from './controllers/auth.controller.js';
import { createGitHubController } from './controllers/github.controller.js';
import { cors } from './middleware/cors.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { authRoutes } from './routes/auth.routes.js';
import { githubRoutes } from './routes/github.routes.js';
import { createServices } from './services/index.js';

/**
 * MVC wiring:  routes/ (URL → controller)  ·  controllers/ (HTTP in/out)  ·  services/ (logic + external APIs).
 * Views are JSON responses and redirects.
 */
export function createApp(config, { fetchImpl = fetch } = {}) {
  const services = createServices(config, fetchImpl);
  const auth = createAuthController({ config, services });
  const github = createGitHubController({ services });

  const app = express();
  app.set('trust proxy', 1); // Render (or any reverse proxy) terminates TLS in front of the app
  app.disable('x-powered-by');
  app.use(cors(config.frontendOrigins));
  app.use(express.json({ limit: '200kb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/auth', authRoutes(auth, services.tokens, config));
  app.use('/github', githubRoutes(github, services.tokens));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
