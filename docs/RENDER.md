# Production setup: GitHub Pages + Render

This guide takes the repository from "pushed to GitHub" to a running FAIRTaxonomy:

| Part | Folder | Runs on | Deployed by |
| --- | --- | --- | --- |
| App (React) | `app/` | GitHub Pages | `.github/workflows/app.yml` |
| Core API (Express) | `backend/core/` | Render web service `fairtaxonomy-core` | `.github/workflows/core.yml` |
| IAM (Keycloak) | `backend/iam/docker/` | Render Docker service `fairtaxonomy-iam` | `.github/workflows/iam.yml` |
| IAM database | — | Render Postgres `fairtaxonomy-iam-db` | created once by `render.yaml` |
| Ontology | `main.ttl` (repository root) | read by the app from GitHub | no deploy needed |

**Configuration lives only in GitHub** (Secrets and Variables). On every deploy, the core and IAM workflows push it
to Render through the Render API, then deploy exactly the commit that passed the tests. You never type a secret
into the Render dashboard, and the Render services have auto-deploy switched off.

Plan about 30–45 minutes for the first setup.

---

## 0. Before you start

- A GitHub repository containing this code. You need admin rights on it, and `main` is the deployed branch.
- A Render account (https://dashboard.render.com), signed in with GitHub so it can read the repository.
- The GitHub App from the main README, step 2 (Client ID, client secret, App ID, private key, installed on the
  repository).
- Optional: a Helmholtz ID OIDC client (main README, step 3).

### Choosing Render plans

`render.yaml` starts everything on the **free** plans so you can try the setup at no cost. Free plans have these
limits:

| Limit | Effect |
| --- | --- |
| Free web services sleep after 15 minutes without traffic and need about 1 minute to wake up | The first login of the day is slow. Keycloak wakes up slower still. |
| Free web services have 512 MB RAM and 0.1 CPU | Enough for core. Too little for Keycloak beyond a quick test: it may start very slowly or run out of memory. |
| A free Postgres database expires 30 days after creation, then is deleted after a 14-day grace period | All accounts created through Register are lost. |

For real use, switch in the Render dashboard (or in `render.yaml`):
- **IAM:** plan **Standard** (`1c-2g`, 2 GB).
- **IAM database:** a paid Postgres plan, e.g. `basic-256mb`.
- **Core:** can stay small (**Starter**). Free works too if you accept the 1-minute wake-up.

Not running your own Keycloak at all? Skip the IAM service and point core at an existing Keycloak (see
[Use an external Keycloak](#use-an-external-keycloak-eg-nomads)).

---

## 1. Generate the secrets (on your computer)

```bash
openssl rand -hex 32    # → SESSION_SECRET          (core: signs session tokens)
openssl rand -hex 32    # → KEYCLOAK_CLIENT_SECRET  (shared by core and IAM)
openssl rand -base64 24 # → IAM_ADMIN_PASSWORD      (Keycloak admin console)
```

Keep them in a password manager. They go into GitHub in step 4 and nowhere else.

The workflows refuse weak values:
- Core does not start with a `SESSION_SECRET` shorter than 32 characters.
- IAM does not start with an admin password shorter than 12 characters, or equal to `admin`.
- IAM does not start with a client secret shorter than 32 characters.

---

## 2. Create the Render services from the Blueprint

1. Render dashboard → **New** → **Blueprint**.
2. Pick this repository and branch `main`. Render finds `render.yaml` at the root.
3. Check the plan of each resource (see step 0), then click **Apply**.

Render creates:
- **fairtaxonomy-core**: Node, root directory `backend/core`, health check `/health`.
- **fairtaxonomy-iam**: Docker, built from `backend/iam/docker`, health check `/realms/fairtaxonomy`.
- **fairtaxonomy-iam-db**: Postgres, reachable only from your Render services.

The first deploys run before any configuration exists, which is expected:
- **core** starts with no logins configured. `/health` answers, and the Login dialog shows the logins as not configured.
- **iam** stops on purpose with `KC_BOOTSTRAP_ADMIN_PASSWORD is not set`. It stays in that state until step 6.

Write down for each web service (from its page in the dashboard):

| What | Where | Example |
| --- | --- | --- |
| Public URL | top of the service page | `https://fairtaxonomy-core.onrender.com` |
| Service ID | **Settings** → *Service ID*, or the dashboard URL | `srv-cr1abc2def3ghi4jkl5m` |

Render may add a suffix to the URL if the name is taken. Always copy the real URL.

## 3. Create a Render API key

Render dashboard → avatar → **Account Settings** → **API Keys** → **Create API Key**.

This key can manage everything in your Render account, so store it only as a GitHub **secret**.

---

## 4. Configure GitHub

Repository → **Settings**:

### 4a. Environment `production`

**Environments** → **New environment** → `production`. Recommended protection rules:

- **Deployment branches and tags:** *Selected branches* → `main`.
- **Required reviewers** (optional): yourself, if you want to approve each backend deploy.

### 4b. Secrets (in the `production` environment)

**Environments → production → Environment secrets → Add secret**:

| Secret | Value | Used by |
| --- | --- | --- |
| `RENDER_API_KEY` | from step 3 | core, iam workflows |
| `SESSION_SECRET` | from step 1 | core |
| `KEYCLOAK_CLIENT_SECRET` | from step 1 | core and iam (must be the same value) |
| `IAM_ADMIN_PASSWORD` | from step 1 | iam (Keycloak admin console) |
| `GH_APP_CLIENT_SECRET` | GitHub App → client secret | core |
| `GH_APP_PRIVATE_KEY` | GitHub App → the whole `.pem` file, pasted as is (including the BEGIN/END lines) | core |
| `HELMHOLTZ_CLIENT_SECRET` | optional, your Helmholtz ID client | core |

GitHub reserves the `GITHUB_` prefix, which is why these are named `GH_APP_*`. The workflow maps them to
`GITHUB_CLIENT_SECRET` and the other `GITHUB_*` variables on Render.

### 4c. Variables (at repository level)

**Secrets and variables → Actions → Variables tab → New repository variable**.

Put them at repository level, not in the environment, because the Pages build and the "should we deploy?" checks
read them outside the `production` environment.

| Variable | Value | Used by |
| --- | --- | --- |
| `CORE_URL` | core public URL, e.g. `https://fairtaxonomy-core.onrender.com` (no trailing slash) | app, core, iam |
| `IAM_URL` | IAM public URL, e.g. `https://fairtaxonomy-iam.onrender.com` | core, iam |
| `RENDER_CORE_SERVICE_ID` | `srv-…` of fairtaxonomy-core | core workflow |
| `RENDER_IAM_SERVICE_ID` | `srv-…` of fairtaxonomy-iam | iam workflow |
| `GH_APP_ID` | GitHub App → App ID | core |
| `GH_APP_CLIENT_ID` | GitHub App → Client ID | core |
| `HELMHOLTZ_CLIENT_ID` | optional; turns on the "Sign in with Helmholtz ID" button | core |

**Optional variables (with defaults):**

| Variable | Default | Meaning |
| --- | --- | --- |
| `FRONTEND_ORIGINS` | `https://<owner>.github.io` | Origins allowed to call core (comma-separated). Set this when using a custom domain. |
| `PROXY_REPOS` | this repository | Repositories the on-behalf-of proxy may access |
| `HELMHOLTZ_ISSUER` | `https://login.helmholtz.de/oauth2` | Use `https://login-dev.helmholtz.de/oauth2` for the test instance |
| `OIDC_PROVIDERS` | derived from what is configured | Explicit list, e.g. `helmholtz,keycloak`, or `off` |
| `KEYCLOAK_ISSUER` | `<IAM_URL>/realms/fairtaxonomy` | Point at an external Keycloak instead |
| `KEYCLOAK_CLIENT_ID` | `fairtaxonomy-backend` | Client ID in Keycloak |
| `REGISTRATION` | on | `off` hides **Register** (no sign-up from the app) |
| `REGISTRATION_RATE_LIMIT` | `10` | Sign-ups per IP per hour |
| `IAM_ADMIN_USER` | `admin` | Keycloak admin username |
| `PAGES_BASE` | `/<repo>/` (or `/` for `<owner>.github.io`) | Base path of the app on Pages |
| `ONTOLOGY_PATH` | `main.ttl` | Path of the ontology in this repository |
| `PROTECTED_BRANCHES_PUBLIC` | `false` | `true` lets signed-out visitors read protected branches |
| `ISSUES_OWNER` / `ISSUES_REPO` | this repository | Where comment issues are created |

You don't need to set the owner, repository name or default branch of the ontology. The app workflow takes them
from the GitHub context, so the app always reads `main.ttl` from this repository.

### 4d. GitHub Pages

**Pages** → *Build and deployment* → **Source: GitHub Actions**.

## 5. Add the production callback URLs

| Provider | Add redirect / callback URL |
| --- | --- |
| GitHub App (Settings → Developer settings → GitHub Apps → your app) | `<CORE_URL>/auth/github/callback` |
| Helmholtz ID client (if used) | `<CORE_URL>/auth/helmholtz/callback` |

Keep the `localhost` URLs too if you also develop locally. The Keycloak redirect URL
(`<CORE_URL>/auth/keycloak/callback`) is set automatically when the realm is imported.

---

## 6. First deploy

Actions tab → run each workflow once (**Run workflow** → branch `main`), in this order:

1. **iam**:
   - It builds the image, pushes the settings to Render, deploys, and waits until Keycloak is live.
   - The first start takes several minutes, because Keycloak sets up the database and imports the realm.
   - The workflow waits up to 30 minutes.
2. **core**: runs the tests, pushes the settings, deploys, and waits until live.
3. **app**: lint, tests and build, then publishes to GitHub Pages. The Pages URL is shown on the run.

After that, everything is automatic. A push to `main` touching `app/**`, `backend/core/**` or `backend/iam/**` runs
the matching workflow. Pull requests run tests only.

## 7. Check

```bash
curl https://fairtaxonomy-core.onrender.com/health                                   # {"ok":true}
curl https://fairtaxonomy-core.onrender.com/auth/providers                           # configured logins
curl https://fairtaxonomy-iam.onrender.com/realms/fairtaxonomy/.well-known/openid-configuration
```

Then open the Pages URL:
- The Overview loads without login, if the repository is public and `main` isn't protected.
- **Login** shows the configured providers.
- **Register** creates an account and signs you in.

Keycloak admin console: `<IAM_URL>/admin`, signed in as `IAM_ADMIN_USER` / `IAM_ADMIN_PASSWORD`.

---

## Day-to-day

| Task | How |
| --- | --- |
| Change a setting | Edit the GitHub Variable or Secret, then Actions → **core** (or **iam**) → **Run workflow**. |
| Rotate `SESSION_SECRET` | Update the secret, then re-run **core**. Everyone is signed out. |
| Rotate `KEYCLOAK_CLIENT_SECRET` | The realm is imported only once, so first change the secret in Keycloak (admin console → realm *fairtaxonomy* → Clients → `fairtaxonomy-backend` → Credentials → Regenerate). Then put the new value in GitHub and re-run **core** and **iam**. |
| Change the admin password | Change it in the Keycloak admin console. `IAM_ADMIN_PASSWORD` is only used to create the first admin. |
| Update the realm file | It applies only to an empty database. For a running IAM, change the realm in the admin console (or export, edit, and re-import it). |
| Update the ontology | Commit `main.ttl`. No deploy is needed; the app reads it from GitHub on load. |
| See what was pushed | The workflow log lists the variable names it synced, never their values. |

## Use an external Keycloak (e.g. NOMAD's)

1. Ask its administrators for a confidential client with:
   - redirect URI `<CORE_URL>/auth/keycloak/callback`
   - standard flow on
   - direct access grants on, if you want the email + password form
   - a service account with `manage-users`, only if you want **Register**
2. Set these Variables:
   - `KEYCLOAK_ISSUER=https://<host>/realms/<realm>`
   - `KEYCLOAK_CLIENT_ID=<client>`
   - `REGISTRATION=off`, unless you got the service account.
3. Set the `KEYCLOAK_CLIENT_SECRET` secret to their client secret.
4. Remove the `RENDER_IAM_SERVICE_ID` variable (the iam workflow then stops deploying), and delete the
   `fairtaxonomy-iam` service and database in Render.
5. Re-run **core**.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| A workflow's deploy job is skipped | `RENDER_CORE_SERVICE_ID` / `RENDER_IAM_SERVICE_ID` isn't set as a **repository** variable, or the run wasn't on `main`. |
| `RENDER_API_KEY is not set` | The secret is missing from the `production` environment, or the job isn't using that environment. |
| `PUT /services/… → 401/404` | Wrong API key, or the service ID belongs to another account or workspace. |
| IAM log: `… is not set` / `must be ≥ …` | The production guard: set the named secret or variable with a strong value, then re-run **iam**. |
| IAM restarts or is killed for memory | The free or Starter plan is too small for Keycloak. Use Standard (2 GB). |
| IAM deploy times out on the first run | Keycloak's first start on a small plan is slow. Re-run **iam**; the second start is much faster. |
| App: "sign-in service not reachable" | Wrong `CORE_URL`, or core is asleep (free plan: wait about 1 minute). |
| Browser CORS error from core | The Pages origin isn't in `FRONTEND_ORIGINS` (default `https://<owner>.github.io`, lower-case, no path). |
| GitHub login: "redirect_uri is not associated" | Add `<CORE_URL>/auth/github/callback` to the GitHub App (step 5). |
| Email login: `invalid_client` | `KEYCLOAK_CLIENT_SECRET` in GitHub differs from the secret in Keycloak (see rotating, above). |
| University / email users: `app_not_installed` | Install the GitHub App on the repository listed in `PROXY_REPOS`. |
| Accounts disappeared after a month | The free Postgres expired. Use a paid database plan. |

## Security notes

- **No secrets in the repository or in the app.** All `VITE_*` values are public, and secrets exist only in the GitHub
  `production` environment and in the Render services.
- **Deploys happen only from `main`, after tests pass,** through the protected `production` environment. Render
  auto-deploy is off, so a push can't bypass the workflows.
- **Secure defaults in production:**
  - core refuses short session secrets;
  - the IAM image has no built-in credentials and refuses development secrets;
  - Keycloak runs behind Render's TLS with `KC_PROXY_HEADERS=xforwarded`;
  - the database accepts connections only from your Render services.
- **Least privilege for the GitHub App:** Contents (read), Issues (read and write), Metadata (read). The proxy also
  limits which repositories, API routes and request fields it forwards.
