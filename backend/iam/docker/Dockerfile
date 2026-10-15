# FAIRTaxonomy IAM — Keycloak for the email + password login and sign-up.
#
#   Local:      docker compose up iam            (from the repository root; start-dev, H2, http://localhost:8080)
#   Production: Render Docker web service        (KC_COMMAND=start, Render Postgres; see docs/RENDER.md)
#
# No credentials are baked into the image: development defaults are applied by entrypoint.sh in
# start-dev only, and production refuses to start without real secrets.
# Later the core API can point at an existing Keycloak (e.g. NOMAD's) via OIDC_KEYCLOAK_ISSUER instead.

# ── Build stage: bake the production build options in (database, health, single-node cache), so
#    `start --optimized` skips Keycloak's slow re-build at every start — important on small instances.
FROM quay.io/keycloak/keycloak:26.3 AS builder
ENV KC_DB=postgres \
    KC_HEALTH_ENABLED=true \
    KC_CACHE=local
RUN /opt/keycloak/bin/kc.sh build

# ── Runtime image
FROM quay.io/keycloak/keycloak:26.3
COPY --from=builder /opt/keycloak/ /opt/keycloak/
COPY realm/fairtaxonomy.json /opt/keycloak/data/import/fairtaxonomy.json
COPY entrypoint.sh /opt/keycloak/bin/fairtaxonomy-entrypoint.sh
# Owned by the keycloak user, so a mounted volume (compose.yaml) is writable.
RUN mkdir -p /opt/keycloak/data/h2

# Fits Render's 512 MB instances (free / starter): fixed memory caps instead of percentages, so
# heap + metaspace + code cache + threads stay below the container limit, plus small thread / DB pools.
# On ≥ 2 GB plans you can raise -Xmx (e.g. -Xmx1g) via JAVA_OPTS_KC_HEAP in Render.
ENV KC_HTTP_PORT=8080 \
    JAVA_OPTS_KC_HEAP="-Xms64m -Xmx192m" \
    JAVA_OPTS_APPEND="-XX:MaxMetaspaceSize=176m -XX:ReservedCodeCacheSize=40m -XX:MaxDirectMemorySize=32m -Xss256k -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:CICompilerCount=1" \
    KC_HTTP_POOL_MAX_THREADS=8 \
    KC_DB_POOL_INITIAL_SIZE=1 \
    KC_DB_POOL_MIN_SIZE=1 \
    KC_DB_POOL_MAX_SIZE=5

EXPOSE 8080
# Run through bash, so the script needs no execute bit (works with the legacy Docker builder too).
ENTRYPOINT ["/bin/bash", "/opt/keycloak/bin/fairtaxonomy-entrypoint.sh"]