import { createGitHubApp } from './githubApp.js';
import { createGitHubOAuthProvider } from './githubOAuth.js';
import { createGitHubProxy } from './githubProxy.js';
import { createKeycloakRegistration } from './keycloakRegistration.js';
import { createOidcProvider } from './oidc.js';
import { createTokenService } from './tokens.js';

/**
 * Builds every service (the "model" layer) from config. `fetchImpl` is
 * injectable so tests can stand in for GitHub and the identity providers.
 */
export function createServices(config, fetchImpl = fetch) {
  const providers = new Map();

  if (config.github.clientId && config.github.clientSecret) {
    providers.set('github', createGitHubOAuthProvider(config.github, fetchImpl));
  }
  for (const oidc of config.oidc) {
    if (oidc.issuer && oidc.clientId) providers.set(oidc.id, createOidcProvider(oidc, fetchImpl));
  }

  const passwordProvider = config.passwordProvider ? providers.get(config.passwordProvider) : undefined;
  if (config.passwordProvider && !passwordProvider?.passwordLogin) {
    console.warn(`[config] PASSWORD_PROVIDER="${config.passwordProvider}" is not a configured OIDC provider.`);
  }

  const registrationProvider = config.registrationProvider ? providers.get(config.registrationProvider) : undefined;
  if (config.registrationProvider && !registrationProvider?.clientCredentialsToken) {
    console.warn(`[config] REGISTRATION_PROVIDER="${config.registrationProvider}" is not a configured OIDC (Keycloak) provider.`);
  }

  const githubApp = createGitHubApp(config.github, fetchImpl);

  return {
    tokens: createTokenService(config.sessionSecret, config.sessionTtlSeconds),
    providers,
    passwordProvider: passwordProvider?.passwordLogin ? passwordProvider : null,
    registration: registrationProvider?.clientCredentialsToken ? createKeycloakRegistration(registrationProvider, fetchImpl) : null,
    githubApp,
    githubProxy: createGitHubProxy(config.github, githubApp, fetchImpl),
  };
}
