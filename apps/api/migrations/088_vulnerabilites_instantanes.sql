-- Module Vulnérabilités (ADR 0100, lot S2 ; décision du RSSI du 18/11/2026) : historique de la situation, pour les tendances
-- et le rapport de pilotage. Migration additive : deux tables nouvelles et un index ; aucune donnée reprise ni reconstruite
-- (consigne du 14/11/2026) : l'historique commence à l'installation du lot.
-- - `vulnerabilites_instantanes` : un instantané par jour (fuseau de l'organisation), pris au tic de l'API. Le créneau du
--   jour est consommé AVANT le calcul (ligne « en_cours ») : un calcul en échec laisse « echec » et n'est pas rejoué le même
--   jour ; un jour sans tic (panne) reste sans instantané, rien n'est rattrapé. Niveau d'alerte de la plateforme (1 à 4).
-- - `vulnerabilites_instantanes_mesures` : les nombres de l'instantané, pour toute la plateforme (« global »), par périmètre
--   effectif des machines et périmètre AlgoLightHouse relié (« perimetre »), et pour ce qui n'a pas de périmètre (« aucun »).
--   Des nombres seulement : aucun nom de machine, de domaine, d'adresse ni de compte. Sans clé étrangère vers grc_smsis,
--   comme les autres tables du module : la remise à vide du travail ne bute pas sur cette table, et la ligne d'un périmètre
--   effacé n'est plus lue (droits de la pyramide) puis part avec la rétention.
-- - Rétention : purge au même tic des instantanés plus anciens que la rétention écrite dans le code (trois ans, à confirmer
--   par le RSSI) ; les mesures partent avec leur instantané.
-- Remise à vide (apps/api/src/remise-a-vide.ts) : les deux tables avec le travail.

CREATE TABLE vulnerabilites_instantanes (
  jour   date PRIMARY KEY,
  debut  timestamptz NOT NULL DEFAULT now(),
  fin    timestamptz,
  etat   text NOT NULL DEFAULT 'en_cours' CHECK (etat IN ('en_cours', 'pris', 'echec')),
  niveau smallint CHECK (niveau IS NULL OR niveau BETWEEN 1 AND 4),
  CONSTRAINT vulnerabilites_instantanes_pris CHECK (etat <> 'pris' OR (niveau IS NOT NULL AND fin IS NOT NULL))
);

CREATE TABLE vulnerabilites_instantanes_mesures (
  jour             date NOT NULL REFERENCES vulnerabilites_instantanes (jour) ON DELETE CASCADE,
  portee           text NOT NULL CHECK (portee IN ('global', 'perimetre', 'aucun')),
  perimetre_id     uuid,
  p1               integer NOT NULL CHECK (p1 >= 0),
  p2               integer NOT NULL CHECK (p2 >= 0),
  p3               integer NOT NULL CHECK (p3 >= 0),
  p4               integer NOT NULL CHECK (p4 >= 0),
  exploitees       integer NOT NULL CHECK (exploitees >= 0),
  depassements     integer NOT NULL CHECK (depassements >= 0),
  exceptions       integer NOT NULL CHECK (exceptions >= 0),
  corrigees_veille integer NOT NULL CHECK (corrigees_veille >= 0),
  machines         integer NOT NULL CHECK (machines >= 0),
  actifs           integer NOT NULL CHECK (actifs >= 0),
  CONSTRAINT vulnerabilites_instantanes_mesures_portee CHECK ((portee = 'perimetre') = (perimetre_id IS NOT NULL))
);
CREATE UNIQUE INDEX vulnerabilites_instantanes_mesures_cle
  ON vulnerabilites_instantanes_mesures (jour, portee, coalesce(perimetre_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX vulnerabilites_instantanes_mesures_perimetre
  ON vulnerabilites_instantanes_mesures (perimetre_id, jour) WHERE perimetre_id IS NOT NULL;
