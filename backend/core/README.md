# FAIRTaxonomy core API

A minimal Express 5 app with one dependency (`express`). It uses no SDKs: OAuth, OIDC and GitHub are called with plain `fetch`.

```
src/
├── server.js / app.js       start + wiring
├── config.js                env → config (the only reader of process.env)
├── routes/                  URL → controller
├── controllers/             HTTP in/out (auth.controller, github.controller)
├── services/                logic + external APIs ("model")
│   ├── githubOAuth.js       GitHub login wrapper (code → token, refresh)
│   ├── oidc.js              generic OIDC: Helmholtz ID, Keycloak, …
│   ├── keycloakRegistration.js  sign-up via Keycloak Admin API (service account)
│   ├── githubApp.js         GitHub App JWT → installation tokens
│   ├── githubProxy.js       on-behalf-of proxy (allowlist + attribution)
│   └── tokens.js            session JWTs + sealed (encrypted) hand-offs
├── middleware/              cors, requireSession, errors
└── lib/                     cookies, pkce, HttpError
```

## API

| Method & path | Purpose |
| --- | --- |
| `GET /health` | Liveness |
| `GET /auth/providers` | Logins on offer: `{ providers[], password, proxy }` |
| `GET /auth/:provider/login?returnTo=…` | Start login (redirect to the provider) |
| `GET /auth/:provider/callback` | Provider redirect, then redirect to `returnTo#handoff=…` |
| `POST /auth/session` `{ handoff }` | Hand-off → session JSON |
| `POST /auth/password` `{ username, password }` | Email + password → session JSON |
| `POST /auth/register` `{ email, password, firstName, lastName }` | Create a Keycloak account (no email verification), then sign in → session JSON. Rate-limited per IP |
| `POST /auth/github/refresh` `{ refreshToken }` | Refresh a GitHub user token |
| `GET /auth/me` (Bearer) | Current proxy session |
| `* /github/<GitHub REST path>` (Bearer) | Same path as `api.github.com`, executed on behalf of the user |

Session JSON: `{ mode, provider, providerLabel, user, accessToken, refreshToken?, expiresAt? }`

- `mode: "direct"`: `accessToken` is the user's GitHub token. The frontend calls `api.github.com` itself.
- `mode: "proxy"`: `accessToken` is this server's session token. The frontend calls `/github/...`.

The proxy allows only the routes listed in `services/githubProxy.js` and only the repositories in `GITHUB_PROXY_REPOS`.
It keeps only the known body fields and adds an attribution line to every issue and comment it creates.

## Add an identity provider

This needs configuration only, no code:

```env
OIDC_PROVIDERS=helmholtz,keycloak,nomad
OIDC_NOMAD_LABEL=NOMAD
OIDC_NOMAD_ISSUER=https://<keycloak-host>/realms/<realm>
OIDC_NOMAD_CLIENT_ID=…
OIDC_NOMAD_CLIENT_SECRET=…
```

The redirect URI to register with the provider is `<PUBLIC_URL>/auth/nomad/callback`.

## Deploy (Render)

Deployed by `.github/workflows/core.yml`: tests → configuration pushed from GitHub Secrets / Variables to the Render
service → deploy of the tested commit. Nothing is configured by hand on Render. See [docs/RENDER.md](../../docs/RENDER.md).

With `NODE_ENV=production` the server refuses to start without a ≥ 32-character `SESSION_SECRET`. Login state is
stateless (signed / sealed tokens), so several instances work.

## Tests

```bash
npm test
```

The tests run the real app against simulated GitHub and OIDC providers: all login flows, the proxy, and the security checks.
