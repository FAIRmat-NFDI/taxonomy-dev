import { HttpError } from '../lib/httpError.js';

/**
 * Sign-up from the web app's own form (no email verification).
 * Creates the user through Keycloak's Admin API, authenticated as this
 * backend's service account (needs realm-management → manage-users).
 * Admin base URL is derived from the issuer:  …/realms/<r>  →  …/admin/realms/<r>
 */
export function createKeycloakRegistration(provider, fetchImpl = fetch) {
  const adminBase = provider.issuer.replace(/\/realms\//, '/admin/realms/');

  return {
    provider,

    async createUser({ email, password, firstName, lastName }) {
      const token = await provider.clientCredentialsToken();
      const res = await fetchImpl(`${adminBase}/users`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          username: email,
          email,
          firstName,
          lastName,
          enabled: true,
          emailVerified: true, // no verification step for now
          requiredActions: [],
          credentials: [{ type: 'password', value: password, temporary: false }],
        }),
      });

      if (res.status === 201) return;
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) throw new HttpError(409, 'account_exists', 'An account with this email already exists. Sign in instead.');
      if (res.status === 401 || res.status === 403) {
        throw new HttpError(502, 'registration_misconfigured', 'The backend is not allowed to create users (service account needs manage-users).');
      }
      // e.g. a Keycloak password policy violation
      throw new HttpError(400, 'registration_failed', data.errorMessage ?? data.error_description ?? `Registration failed (${res.status}).`);
    },
  };
}
