import { createApp } from './app.js';
import { loadConfig, loadDotEnv } from './config.js';

loadDotEnv();
const config = loadConfig();
const app = createApp(config);

app.listen(config.port, () => {
  const providers = [config.github.clientId && 'github', ...config.oidc.map((p) => p.id)].filter(Boolean);
  console.log(`FAIRTaxonomy backend on ${config.publicUrl}`);
  console.log(`  login providers: ${providers.join(', ') || '(none configured)'}`);
  console.log(`  password login:  ${config.passwordProvider ?? '(off)'}`);
  console.log(`  registration:    ${config.registrationProvider ?? '(off)'}`);
  console.log(`  GitHub proxy:    ${config.github.appId ? config.github.proxyRepos.join(', ') || '(no repos allowed)' : '(off — no GitHub App key)'}`);
  console.log(`  frontend origins: ${config.frontendOrigins.join(', ')}`);
});
