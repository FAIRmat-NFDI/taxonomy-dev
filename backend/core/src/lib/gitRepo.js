import { execFileSync } from 'node:child_process';

/**
 * "owner/repo" of the git remote "origin" if it is on GitHub, else ''.
 * Local-development default only — deployments pass GITHUB_PROXY_REPOS explicitly.
 */
export function repositoryFromGit(cwd = process.cwd()) {
  try {
    const url = execFileSync('git', ['config', '--get', 'remote.origin.url'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const match = /github\.com[:/]([^/]+)\/([^/]+?)(\.git)?$/.exec(url);
    return match ? `${match[1]}/${match[2]}` : '';
  } catch {
    return '';
  }
}
