#!/usr/bin/env bash
# État de la base : taille, fichiers temporaires et cache depuis la remise à zéro des statistiques, plus grosses tables,
# réglages de PostgreSQL appliqués (pg_settings).   etat-base.sh <étiquette>
P=$BANC/perf/psql.sh
echo "== $(date -Iseconds) $1"
$P -c "select pg_size_pretty(pg_database_size('suivi')) taille, pg_database_size('suivi') octets"
$P -c "select temp_files, pg_size_pretty(temp_bytes) temp, temp_bytes, blks_read, blks_hit, round(100.0*blks_hit/nullif(blks_hit+blks_read,0),2) cache_pct, stats_reset from pg_stat_database where datname='suivi'"
$P -c "select name, setting, unit, source from pg_settings where name in ('shared_buffers','work_mem','effective_cache_size','jit','max_connections','log_min_duration_statement') order by name"
$P -c "select c.relname, pg_size_pretty(pg_total_relation_size(c.oid)) total, pg_size_pretty(pg_relation_size(c.oid)) tas, pg_size_pretty(pg_indexes_size(c.oid)) index, s.n_live_tup vivantes, s.n_dead_tup mortes from pg_class c join pg_namespace n on n.oid=c.relnamespace left join pg_stat_user_tables s on s.relid=c.oid where n.nspname='public' and c.relkind='r' order by pg_total_relation_size(c.oid) desc limit 15"
