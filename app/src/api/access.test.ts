import { describe, expect, it } from 'vitest';
import { decideAccess } from './access';
import type { BranchAccess } from './types';

const branch = (over: Partial<BranchAccess>): BranchAccess => ({ branch: 'main', visibility: 'public', protected: false, commit: 'c1', ...over });
const policy = { protectedBranchesRequireLogin: true };

describe('decideAccess', () => {
  it('reads public, unprotected branches anonymously; comments need sign-in', () => {
    expect(decideAccess(branch({}), false, policy)).toEqual({ read: 'anonymous', canComment: false, reason: 'public-branch' });
    expect(decideAccess(branch({}), true, policy)).toEqual({ read: 'anonymous', canComment: true, reason: 'public-branch' });
  });

  it('requires sign-in for protected branches (by default) and non-public repositories', () => {
    expect(decideAccess(branch({ protected: true }), false, policy).read).toBe('login-required');
    expect(decideAccess(branch({ protected: true }), true, policy).read).toBe('authenticated');
    expect(decideAccess(branch({ visibility: 'restricted', commit: null }), false, policy).read).toBe('login-required');
  });

  it('can treat protected branches as public', () => {
    expect(decideAccess(branch({ protected: true }), false, { protectedBranchesRequireLogin: false }).read).toBe('anonymous');
  });
});
