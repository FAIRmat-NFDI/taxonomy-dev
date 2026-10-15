import type { AccessDecision, BranchAccess } from './types';

export interface AccessPolicy {
  /** Require sign-in to view branches that have GitHub branch protection (app policy, not a GitHub rule). */
  protectedBranchesRequireLogin: boolean;
}

/**
 * Who may read the ontology and how:
 *
 *  repository        branch        signed out          signed in
 *  ───────────────── ───────────── ─────────────────── ─────────────────────────
 *  public            unprotected   anonymous, no comments   anonymous read + comments
 *  public            protected     login required*     authenticated
 *  private / hidden  –             login required      authenticated
 *
 *  * when `protectedBranchesRequireLogin` (default). Otherwise like an unprotected branch.
 *
 * Anonymous reads skip GitHub auth and the backend proxy entirely.
 */
export function decideAccess(branch: BranchAccess, signedIn: boolean, policy: AccessPolicy): AccessDecision {
  if (branch.visibility === 'restricted') {
    return { read: signedIn ? 'authenticated' : 'login-required', canComment: signedIn, reason: 'restricted-repository' };
  }
  if (branch.protected && policy.protectedBranchesRequireLogin) {
    return { read: signedIn ? 'authenticated' : 'login-required', canComment: signedIn, reason: 'protected-branch' };
  }
  return { read: 'anonymous', canComment: signedIn, reason: 'public-branch' };
}
