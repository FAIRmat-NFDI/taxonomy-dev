import { execFileSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

/**
 * The ontology (main.ttl) lives in this repository. When VITE_GH_OWNER / VITE_GH_REPO are not
 * set (local dev without .env.local), take them from the git remote "origin".
 * CI sets them explicitly from the GitHub context (.github/workflows/app.yml).
 */
function repositoryFromGit(): { owner: string; repo: string } | null {
  try {
    const url = execFileSync('git', ['config', '--get', 'remote.origin.url'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const match = /github\.com[:/]([^/]+)\/([^/]+?)(\.git)?$/.exec(url);
    return match ? { owner: match[1]!, repo: match[2]! } : null;
  } catch {
    return null;
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (!env.VITE_GH_OWNER || !env.VITE_GH_REPO) {
    const origin = repositoryFromGit();
    // process.env VITE_* values are picked up by Vite's own env loading.
    if (origin) {
      process.env.VITE_GH_OWNER ||= origin.owner;
      process.env.VITE_GH_REPO ||= origin.repo;
    }
  }

  return {
    // GitHub Pages serves project sites from /<repo>/ — set VITE_BASE in CI.
    base: env.VITE_BASE || '/',
    // svgr: `import Icon from './x.svg?react'` → React component (used by the icon registry).
    plugins: [react(), svgr()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    worker: {
      format: 'es',
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          // Keep heavy vendor groups in separate, cacheable chunks.
          manualChunks: (id: string) => {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('@mui') || id.includes('@emotion')) return 'vendor-mui';
            if (id.includes('n3')) return 'vendor-rdf';
            // Graph libraries load only with the graph view (lazy import).
            if (/cytoscape|cose-base|layout-base/.test(id)) return 'vendor-graph';
            return 'vendor';
          },
        },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
