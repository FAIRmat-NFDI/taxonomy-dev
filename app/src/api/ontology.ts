import { config } from '@/config';
import { decideAccess } from './access';
import { getBranchAccess, getFile, getPublicFile } from './github/repository';
import { materializeTurtle } from './rdf/engine';
import type { AccessDecision, BranchAccess, OntologyModel } from './types';

export interface LoadedSource {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  /** Commit (anonymous reads) — used for stable "view on GitHub" links. */
  commit: string | null;
}

export type OntologyLoadResult =
  | { status: 'ready'; source: LoadedSource; access: AccessDecision; model: OntologyModel; text: string }
  | { status: 'login-required'; source: LoadedSource; access: AccessDecision };

/**
 * Loads the ontology of a branch for the current user:
 *  1. probe the branch anonymously (public? protected? head commit)
 *  2. decide the access path (see access.ts)
 *  3. read the TTL — raw.githubusercontent.com when anonymous, GitHub API / backend proxy when signed in
 *  4. parse + materialize in a Web Worker
 */
export async function loadOntology({ branch, signedIn, path = config.source.path }: { branch: string; signedIn: boolean; path?: string }): Promise<OntologyLoadResult> {
  const probe: BranchAccess = await getBranchAccess(branch);
  const access = decideAccess(probe, signedIn, config.access);
  const source: LoadedSource = { owner: config.source.owner, repo: config.source.repo, branch, path, commit: probe.commit };

  if (access.read === 'login-required') return { status: 'login-required', source, access };

  const file = access.read === 'anonymous' && probe.commit ? await getPublicFile(path, probe.commit, branch) : await getFile(path, branch);
  const model = await materializeTurtle(file.content);
  return { status: 'ready', source: { ...source, commit: file.commit ?? source.commit }, access, model, text: file.content };
}
