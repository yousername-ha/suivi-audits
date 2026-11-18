-- Module Vulnérabilités (ADR 0100, lot V4d) : périmètre des machines Tenable relié par dépôt (décision du RSSI du 17/11/2026 :
-- « par groupe entier », comme les périmètres AlgoLightHouse de la migration 080). Le « groupe » retenu est le dépôt de Tenable
-- Security Center (`repository` d'un résultat de l'analyse `vulndetails`, déjà reçu : aucun appel nouveau), choix à confirmer
-- par le RSSI. Migration additive : une table nouvelle et une colonne nullable ajoutée à vulnerabilites_machines (075), sans
-- reprise de données (consigne du 14/11/2026) : les machines déjà rattachées à la main gardent leur périmètre.
-- Règle : périmètre effectif d'une machine = le sien (indiqué à la main, qui prime), sinon celui de son dépôt relié. Une
-- machine sans l'un ni l'autre n'est lisible qu'avec vulnerabilites:administrer (ADR 0100, point 14, inchangé).
-- Remise à vide (apps/api/src/remise-a-vide.ts) : dépôts et liaisons avec le travail, comme les machines (relus à la
-- synchronisation suivante ; liaison saisie par les utilisateurs et rattachée à grc_smsis).

-- Dépôts vus par instance : identifiant et nom dans Tenable (seuls champs lus du dépôt), liaison à un périmètre de la
-- plateforme (NULL : non relié). `version` ne change qu'avec la liaison (If-Match) ; une synchronisation ne la touche pas.
CREATE TABLE vulnerabilites_tenable_depots (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  depot_tenable  integer NOT NULL CHECK (depot_tenable BETWEEN 1 AND 999999999),
  nom            text NOT NULL CHECK (char_length(nom) BETWEEN 1 AND 200 AND nom !~ '[[:cntrl:]]'),
  perimetre_id   uuid REFERENCES grc_smsis(id) ON DELETE SET NULL,
  vu_numero      integer NOT NULL CHECK (vu_numero > 0),
  version        integer NOT NULL DEFAULT 1 CHECK (version > 0),
  cree_le        timestamptz NOT NULL DEFAULT now(),
  maj_le         timestamptz NOT NULL DEFAULT now(),
  maj_par        text,
  UNIQUE (integration_id, depot_tenable)
);
CREATE INDEX vulnerabilites_tenable_depots_perimetre ON vulnerabilites_tenable_depots (perimetre_id);

-- Dépôt d'une machine (NULL : inconnu). Mis à jour par la synchronisation ; ne change ni `version` ni `perimetre_id` de la
-- machine. Un dépôt de la même instance seulement (contrôlé par l'API au rangement).
ALTER TABLE vulnerabilites_machines
  ADD COLUMN depot_id uuid REFERENCES vulnerabilites_tenable_depots(id) ON DELETE SET NULL;
CREATE INDEX vulnerabilites_machines_depot ON vulnerabilites_machines (depot_id);
