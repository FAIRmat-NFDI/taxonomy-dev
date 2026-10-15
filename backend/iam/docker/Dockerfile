# FAIRTaxonomy IAM — Keycloak for the email + password login and sign-up.
#
#   Local:      docker compose up iam            (from the repository root; start-dev, H2, http://localhost:8080)
#   Production: Render Docker web service        (KC_COMMAND=start, Render Postgres; see docs/RENDER.md)
#
# No credentials are baked into the image: development defaults are applied by entrypoint.sh in
# start-dev only, and production refuses to start without real secrets.
# Later the core API can point at an existing Keycloak (e.g. NOMAD's) via OIDC_KEYCLOAK_ISSUER instead.
FROM quay.io/keycloak/keycloak:26.3

COPY realm/fairtaxonomy.json /opt/keycloak/data/import/fairtaxonomy.json
COPY entrypoint.sh /opt/keycloak/bin/fairtaxonomy-entrypoint.sh
# Owned by the keycloak user, so a mounted volume (compose.yaml) is writable.
RUN mkdir -p /opt/keycloak/data/h2

ENV KC_HTTP_PORT=8080 \
    KC_HEALTH_ENABLED=true \
    JAVA_OPTS_KC_HEAP="-XX:MaxRAMPercentage=65"

EXPOSE 8080
# Run through bash, so the script needs no execute bit (works with the legacy Docker builder too).
ENTRYPOINT ["/bin/bash", "/opt/keycloak/bin/fairtaxonomy-entrypoint.sh"]
