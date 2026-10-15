# FAIRTaxonomy app

React app (Vite · TypeScript · MUI · Redux Toolkit · TanStack Query · React Router · N3.js), deployed to GitHub Pages.
It makes plain `fetch` calls and uses no SDKs.

## Structure (MVC-style)

```
src/
├── api/          MODEL       plain TypeScript, no React
│   ├── http.ts               the one fetch wrapper (target = base URL + token)
│   ├── session.ts            current session + browser storage (tokens never go to Redux)
│   ├── auth.ts               all logins via the backend (+ personal-token fallback)
│   ├── github/               client.ts (routes calls by session mode) · repository.ts · issues.ts
│   ├── access.ts             who may read a branch, and how (anonymous / authenticated / login required)
│   ├── ontology.ts           probe branch → read TTL → materialize
│   └── rdf/                  parser.ts (lines) · materialize.ts (node model) · engine.ts + worker · vocab.ts
├── store/        CONTROLLER  Redux: auth, source (branch), ontology (access + node model)
├── hooks/        CONTROLLER  useAuth, useLoginOptions, useOntology (loader, selection in ?node=)
├── components/   VIEW        layout/ · auth/ (sign-in dialog) · doc/ (panes, overview tree) · common/
├── pages/        VIEW        DocPage · GraphPage · AuthCallbackPage · NotFound · RouteError
├── routes/ · theme/ · assets/ · lib/ · config.ts · App.tsx · main.tsx
```

## One GitHub code path for every login

Every GitHub call goes through `api/github/client.ts`. The path and JSON payload are the same for all users;
only the target changes with the session mode:

| Session | Base URL | Token |
| --- | --- | --- |
| anonymous | `https://api.github.com` | none |
| `direct` (GitHub login, personal token) | `https://api.github.com` | the user's GitHub token |
| `proxy` (university, email + password) | `${VITE_API_BASE_URL}/github` | backend session token |

For example, `issuesApi.createThread()` posts `POST /repos/{owner}/{repo}/issues` with `{ title, body }` in both modes.
The backend proxy forwards it on behalf of the user and adds an attribution line.

## Loading the ontology

`AppLayout` loads `VITE_ONTOLOGY_PATH` (default `main.ttl`, repository root) for the selected branch whenever the
branch or the signed-in user changes:

1. **Probe** `GET /repos/{owner}/{repo}/branches/{branch}` without a token: public or not, protected or not, head commit.
2. **Decide** (`api/access.ts`):

   | Repository | Branch | Signed out | Signed in |
   | --- | --- | --- | --- |
   | public | unprotected | read anonymously, comments off | read anonymously, comments on |
   | public | protected | login required ¹ | GitHub API / backend proxy |
   | private | – | login required | GitHub API / backend proxy |

   ¹ App policy, not a GitHub rule (GitHub branch protection only restricts writes). Set `VITE_PROTECTED_BRANCHES_PUBLIC=true`
   to treat protected branches like unprotected ones.
3. **Read** anonymously from `raw.githubusercontent.com/{owner}/{repo}/{commit}/{path}` (pinned to the commit, no API
   rate limit), otherwise through the usual GitHub path for the session.
4. **Materialize** in a Web Worker: N3.js parses with source positions; `materialize.ts` turns triples into a node model
   (entities with hierarchy links, anonymous expressions as Manchester-like text, standalone axioms, cycles), every
   node carrying its file lines. The model is plain JSON and lives in Redux (`state.ontology.model`).

The selected node is in the URL (`/doc?node=<IRI or blank-node id>`), so links and the back button work, and the
Overview tree in the mobile drawer and the desktop column stay in sync without shared state.

## Scripts

`npm run dev` · `npm run build` · `npm run lint` · `npm test`
