# syntax=docker/dockerfile:1
# Exécutant sans serveur HTTP ; les demandes viennent exclusivement de la CLI locale authentifiée.
ARG GO_IMAGE=golang:1.26.9-alpine
FROM ${GO_IMAGE} AS cosign
RUN --mount=type=secret,id=build_ca --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    if [ -f /run/secrets/build_ca ]; then export SSL_CERT_FILE=/run/secrets/build_ca; fi; \
    export CGO_ENABLED=0 GOTOOLCHAIN=local; \
    mkdir /build-cosign && cd /build-cosign && go mod init suivi-cosign \
    && go mod edit -require=github.com/sigstore/cosign/v3@v3.1.3 -require=golang.org/x/net@v0.60.0 -require=golang.org/x/mod@v0.40.0 -require=google.golang.org/grpc@v1.83.2 \
    && go build -mod=mod -o /go/bin/cosign github.com/sigstore/cosign/v3/cmd/cosign
FROM alpine:3.24
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export SSL_CERT_FILE=/run/secrets/build_ca; fi; \
    apk upgrade --no-cache && apk add --no-cache python3 bash docker-cli docker-cli-compose git openssh-client openssl coreutils findutils util-linux tar gzip curl
COPY --from=cosign /go/bin/cosign /usr/local/bin/cosign
COPY scripts/update-worker.py /opt/update-worker.py
LABEL org.opencontainers.image.source="https://github.com/yousername-ha/suivi-audits"
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
CMD ["python3", "/opt/update-worker.py"]
