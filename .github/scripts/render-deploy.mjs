#!/usr/bin/env node
/**
 * Push environment variables from GitHub to a Render service, then deploy the tested commit.
 * Plain Node 22 (fetch), no dependencies. Values are never printed — only key names.
 *
 *   RENDER_API_KEY      Render API key (GitHub secret)
 *   RENDER_SERVICE_ID   srv-… of the target service (GitHub variable)
 *   RENDER_ENV_KEYS     comma-separated entries to sync, each either
 *                         NAME          value from this process's env var NAME, or
 *                         NAME=SOURCE   value from env var SOURCE (e.g. GITHUB_CLIENT_ID=GH_APP_CLIENT_ID,
 *                                       because GitHub reserves the GITHUB_ prefix for its own variables).
 *                       Empty values are skipped (never wipe a value by accident; use "off" to disable).
 *   GITHUB_SHA          commit to deploy (set by GitHub Actions)
 *   DEPLOY_TIMEOUT_MIN  wait for the deploy to go live (default 20; 0 = do not wait)
 *   RENDER_API_URL, DEPLOY_POLL_MS   testing only (mock API, poll interval)
 *
 * Render API: PUT /v1/services/{id}/env-vars/{key} · POST /v1/services/{id}/deploys · GET …/deploys/{deployId}
 */
const API = process.env.RENDER_API_URL || 'https://api.render.com/v1';
const { RENDER_API_KEY: apiKey, RENDER_SERVICE_ID: serviceId, RENDER_ENV_KEYS: keyList = '', GITHUB_SHA: commit } = process.env;
const timeoutMin = Number(process.env.DEPLOY_TIMEOUT_MIN ?? 20);

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}
if (!apiKey) fail('RENDER_API_KEY is not set (GitHub secret).');
if (!/^srv-[a-z0-9]+$/.test(serviceId ?? '')) fail('RENDER_SERVICE_ID is not set or not a Render service id (srv-…).');

async function render(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) fail(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

// 1. Environment variables (one PUT per key: other variables on the service stay untouched)
const entries = keyList
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => {
    const [key, source = key] = entry.split('=').map((s) => s.trim());
    return { key, source };
  });
const synced = [];
const skipped = [];
for (const { key, source } of entries) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(key)) fail(`Invalid variable name "${key}".`);
  const value = process.env[source];
  if (!value) {
    skipped.push(key);
    continue;
  }
  await render('PUT', `/services/${serviceId}/env-vars/${encodeURIComponent(key)}`, { value });
  synced.push(key);
}
console.log(`Synced ${synced.length} variable(s): ${synced.join(', ') || '—'}`);
if (skipped.length) console.log(`Skipped (empty): ${skipped.join(', ')}`);

// 2. Deploy exactly the commit that passed the tests
const deploy = await render('POST', `/services/${serviceId}/deploys`, commit ? { commitId: commit } : {});
const deployId = deploy.id;
console.log(`Deploy ${deployId ?? '(queued)'} started for ${commit ?? 'latest commit'}.`);
if (!deployId || timeoutMin <= 0) process.exit(0);

// 3. Wait until it is live (or failed)
const FAILED = new Set(['build_failed', 'update_failed', 'pre_deploy_failed', 'canceled', 'deactivated']);
const deadline = Date.now() + timeoutMin * 60_000;
let last = '';
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, Number(process.env.DEPLOY_POLL_MS ?? 15_000)));
  const { status } = await render('GET', `/services/${serviceId}/deploys/${deployId}`);
  if (status !== last) console.log(`Status: ${status}`);
  last = status;
  if (status === 'live') process.exit(0);
  if (FAILED.has(status)) fail(`Deploy ${deployId} ended with status "${status}". Check the Render logs.`);
}
fail(`Deploy ${deployId} not live after ${timeoutMin} min (last status: ${last}).`);
