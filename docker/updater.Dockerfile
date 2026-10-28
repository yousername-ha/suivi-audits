# syntax=docker/dockerfile:1
# Exécutant sans serveur HTTP ; les demandes viennent exclusivement de la CLI locale authentifiée.
ARG GO_IMAGE=golang:1.26.10-alpine@sha256:a2012b4a1d1f9f7e9f44e0d39b805a901e856b1dd80b4e6ee4338db547050308
# Les échecs réseau passagers (proxy ou base de sommes de Go) sont réessayés ; la vérification des modules reste active.
FROM ${GO_IMAGE} AS cosign
RUN --mount=type=secret,id=build_ca --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    if [ -f /run/secrets/build_ca ]; then export SSL_CERT_FILE=/run/secrets/build_ca; fi; \
    export CGO_ENABLED=0 GOTOOLCHAIN=local; \
    essayer() { n=1; until "$@"; do [ "$n" -ge 4 ] && return 1; echo "essai $n échoué : $*" >&2; sleep $((n * 15)); n=$((n + 1)); done; }; \
    mkdir /build-cosign && cd /build-cosign && go mod init suivi-cosign \
    && go mod edit -require=github.com/sigstore/cosign/v3@v3.1.3 -require=golang.org/x/net@v0.60.0 -require=golang.org/x/mod@v0.40.0 -require=google.golang.org/grpc@v1.83.2 -require=github.com/klauspost/compress@v1.18.7 -require=github.com/go-jose/go-jose/v4@v4.1.6 \
    && essayer go build -mod=mod -o /go/bin/cosign github.com/sigstore/cosign/v3/cmd/cosign
FROM alpine:3.24@sha256:be2656061b536c1883c4034790e21d0a09c5aaaf51968b89368a3c0371ea2c9a
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export SSL_CERT_FILE=/run/secrets/build_ca; fi; \
    apk upgrade --no-cache && apk add --no-cache python3 bash docker-cli docker-cli-compose git openssh-client openssl age coreutils findutils util-linux tar gzip curl
COPY --from=cosign /go/bin/cosign /usr/local/bin/cosign
COPY scripts/update-worker.py /opt/update-worker.py
LABEL org.opencontainers.image.source="https://github.com/yousername-ha/suivi-audits"
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
CMD ["python3", "/opt/update-worker.py"]
