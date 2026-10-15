#!/bin/bash
# FAIRTaxonomy IAM — Keycloak start-up.
#
#   KC_COMMAND=start-dev (default)  local development: H2 database, HTTP, development defaults
#   KC_COMMAND=start                production (Render): Postgres, behind a TLS proxy, secrets required;
#                                   runs the pre-built image (`start --optimized`, see Dockerfile)
#
# The realm file (realm/fairtaxonomy.json) is imported once, on first start. It reads
# KC_CLIENT_SECRET and CORE_PUBLIC_URL from the environment (Keycloak placeholders).
set -euo pipefail

MODE="${KC_COMMAND:-start-dev}"
fail() { echo "[iam] $*" >&2; exit 1; }

case "$MODE" in
  start)
    for name in KC_BOOTSTRAP_ADMIN_PASSWORD KC_CLIENT_SECRET CORE_PUBLIC_URL KC_HOSTNAME; do
      [[ -n "${!name:-}" ]] || fail "$name is not set. Set it in GitHub (see docs/RENDER.md) and run the 'iam' workflow."
    done
    # Secure by default: never start production with development secrets.
    [[ "$KC_BOOTSTRAP_ADMIN_PASSWORD" != "admin" && ${#KC_BOOTSTRAP_ADMIN_PASSWORD} -ge 12 ]] || fail "KC_BOOTSTRAP_ADMIN_PASSWORD must be ≥ 12 characters and not 'admin'."
    [[ "$KC_CLIENT_SECRET" != dev-only-* && ${#KC_CLIENT_SECRET} -ge 32 ]] || fail "KC_CLIENT_SECRET must be ≥ 32 characters (openssl rand -hex 32)."

    # Render Postgres gives DATABASE_URL=postgres://user:password@host:port/db → Keycloak's JDBC settings.
    if [[ -n "${DATABASE_URL:-}" && -z "${KC_DB_URL:-}" ]]; then
      pattern='^postgres(ql)?://([^:]+):([^@]+)@([^:/]+)(:([0-9]+))?/([^?]+)'
      [[ "$DATABASE_URL" =~ $pattern ]] || fail "DATABASE_URL is not a postgres:// URL."
      export KC_DB=postgres
      export KC_DB_USERNAME="${BASH_REMATCH[2]}"
      export KC_DB_PASSWORD="${BASH_REMATCH[3]}"
      export KC_DB_URL="jdbc:postgresql://${BASH_REMATCH[4]}:${BASH_REMATCH[6]:-5432}/${BASH_REMATCH[7]}"
    fi
    [[ -n "${KC_DB:-}" ]] || fail "No database: set DATABASE_URL (Render Postgres) or KC_DB / KC_DB_URL."

    # TLS ends at the platform's proxy; Keycloak serves HTTP behind it.
    export KC_PROXY_HEADERS="${KC_PROXY_HEADERS:-xforwarded}"
    export KC_HTTP_ENABLED="${KC_HTTP_ENABLED:-true}"
    export KC_BOOTSTRAP_ADMIN_USERNAME="${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}"
    echo "[iam] production start: database $KC_DB, hostname $KC_HOSTNAME, realm import from CORE_PUBLIC_URL=$CORE_PUBLIC_URL"
    exec /opt/keycloak/bin/kc.sh start --optimized --import-realm "$@"
    ;;
  start-dev)
    export KC_BOOTSTRAP_ADMIN_USERNAME="${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}"
    export KC_BOOTSTRAP_ADMIN_PASSWORD="${KC_BOOTSTRAP_ADMIN_PASSWORD:-admin}"
    export KC_CLIENT_SECRET="${KC_CLIENT_SECRET:-dev-only-change-me}"
    export CORE_PUBLIC_URL="${CORE_PUBLIC_URL:-http://localhost:4000}"
    ;;
  *)
    fail "KC_COMMAND must be 'start' or 'start-dev'."
    ;;
esac

exec /opt/keycloak/bin/kc.sh "$MODE" --import-realm "$@"