#!/usr/bin/env bash
# psql superutilisateur dans le conteneur db de la pile du banc
exec docker exec -i -u postgres suivi-banc-perf-db-1 psql -U postgres -d suivi -v ON_ERROR_STOP=1 "$@"
