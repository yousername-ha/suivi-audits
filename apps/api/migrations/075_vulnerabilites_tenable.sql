-- Module Vulnérabilités (ADR 0100, lot V5) : failles et machines lues dans Tenable Security Center par l'opération
-- « synchroniser » du connecteur « tenable » (module Intégrations, ADR 0076). Migration additive : six tables nouvelles,
-- aucune table existante modifiée. Sans reprise de données (consigne du 14/11/2026).
-- Rien n'est supprimé quand une détection disparaît d'une synchronisation : elle garde sa dernière date et son numéro de
-- synchronisation, et n'est plus comptée comme présente dès qu'une synchronisation complète plus récente ne l'a pas vue.
-- Une synchronisation interrompue ou incomplète (borne atteinte) ne fait donc rien disparaître.
-- Remise à vide (apps/api/src/remise-a-vide.ts) : machines, constats, CVE et détections avec le travail (données relues à la
-- synchronisation suivante, rôle et périmètre saisis par les utilisateurs, périmètre rattaché à grc_smsis) ; état des
-- synchronisations par instance et journal des synchronisations avec la configuration, comme les instances et leurs
-- exécutions.

-- Machines : une par instance et par identifiant dans la source (hostUUID de Tenable, à défaut l'adresse et le nom).
-- Rôle (front, back applicatif, base de données) et périmètre : indiqués par une personne ; NULL = non renseigné. Une
-- machine sans périmètre n'est lisible qu'avec vulnerabilites:administrer (ADR 0100, point 14). `version` ne change qu'avec
-- le rôle ou le périmètre (If-Match) ; une synchronisation ne la touche pas.
CREATE TABLE vulnerabilites_machines (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id     uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  source             text NOT NULL DEFAULT 'tenable' CHECK (source IN ('tenable')),
  identifiant_source text NOT NULL CHECK (char_length(identifiant_source) <= 400
                       AND identifiant_source ~ '^(uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|ip:[0-9a-f:.]{2,45}(\|[a-z0-9][a-z0-9._-]{0,254})?)$'),
  uuid_source        uuid,
  nom                text CHECK (nom IS NULL OR (char_length(nom) <= 255 AND nom ~ '^[a-z0-9][a-z0-9._-]*$')),
  adresse            text CHECK (adresse IS NULL OR (char_length(adresse) <= 45 AND adresse ~ '^[0-9a-f:.]+$')),
  systeme            text CHECK (systeme IS NULL OR (char_length(systeme) BETWEEN 1 AND 200 AND systeme !~ '[[:cntrl:]]')),
  premiere_detection timestamptz,
  derniere_detection timestamptz,
  exposition         text CHECK (exposition IS NULL OR (char_length(exposition) <= 40 AND exposition ~ '^[a-z][a-z0-9 _-]*$')),
  acr                numeric(4,1) CHECK (acr IS NULL OR acr BETWEEN 0 AND 10),
  role               text CHECK (role IS NULL OR role IN ('front', 'back', 'bdd')),
  perimetre_id       uuid REFERENCES grc_smsis(id) ON DELETE SET NULL,
  vu_numero          integer NOT NULL CHECK (vu_numero > 0),
  version            integer NOT NULL DEFAULT 1 CHECK (version > 0),
  cree_le            timestamptz NOT NULL DEFAULT now(),
  maj_le             timestamptz NOT NULL DEFAULT now(),
  maj_par            text,
  UNIQUE (integration_id, identifiant_source)
);
CREATE INDEX vulnerabilites_machines_perimetre ON vulnerabilites_machines (perimetre_id);
CREATE INDEX vulnerabilites_machines_nom ON vulnerabilites_machines (lower(nom));

-- Constats : un par instance et par contrôle de Tenable (pluginID). Textes de Tenable gardés en anglais, tels quels, bornés.
-- Score EPSS entre 0 et 1 (Tenable le rend en pourcentage : converti par l'exécutant). Lien « voir aussi » en https.
CREATE TABLE vulnerabilites_constats (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id      uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  plugin_id           integer NOT NULL CHECK (plugin_id BETWEEN 1 AND 999999999),
  nom                 text NOT NULL CHECK (char_length(nom) BETWEEN 1 AND 300),
  gravite             text NOT NULL CHECK (gravite IN ('critique', 'elevee', 'moyenne', 'faible')),
  famille             text CHECK (famille IS NULL OR char_length(famille) BETWEEN 1 AND 100),
  synopsis            text CHECK (synopsis IS NULL OR char_length(synopsis) BETWEEN 1 AND 1000),
  correctif           text CHECK (correctif IS NULL OR char_length(correctif) BETWEEN 1 AND 2000),
  cvss3_vecteur       text CHECK (cvss3_vecteur IS NULL OR (char_length(cvss3_vecteur) <= 200 AND cvss3_vecteur ~ '^(CVSS:3\.[01]/)?[A-Za-z]{1,3}:[A-Za-z]{1,2}(/[A-Za-z]{1,3}:[A-Za-z]{1,2})*$')),
  cvss3_score         numeric(3,1) CHECK (cvss3_score IS NULL OR cvss3_score BETWEEN 0 AND 10),
  vpr_score           numeric(3,1) CHECK (vpr_score IS NULL OR vpr_score BETWEEN 0 AND 10),
  epss_score          numeric(6,5) CHECK (epss_score IS NULL OR epss_score BETWEEN 0 AND 1),
  exploitable         boolean NOT NULL,
  exploit_libelle     text CHECK (exploit_libelle IS NULL OR char_length(exploit_libelle) BETWEEN 1 AND 100),
  faille_publiee_le   timestamptz,
  correctif_publie_le timestamptz,
  fin_support_le      timestamptz,
  voir_aussi          text CHECK (voir_aussi IS NULL OR (char_length(voir_aussi) <= 500 AND voir_aussi ~ '^https://[^[:space:]"''<>\\`]+$')),
  cves_tronquees      boolean NOT NULL DEFAULT false,
  vu_numero           integer NOT NULL CHECK (vu_numero > 0),
  vu_le               timestamptz NOT NULL DEFAULT now(),
  cree_le             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, plugin_id)
);

-- CVE d'un constat (table de liaison ; 500 au plus par constat, contrôlé par l'API). La jointure avec le catalogue KEV de la
-- veille (vulnerabilites_veille_cve) se fait en lecture, sans clé étrangère : une CVE inconnue de la veille reste rangée.
CREATE TABLE vulnerabilites_constat_cves (
  constat_id uuid NOT NULL REFERENCES vulnerabilites_constats(id) ON DELETE CASCADE,
  cve        text NOT NULL CHECK (cve ~ '^CVE-[12][0-9]{3}-[0-9]{4,9}$'),
  PRIMARY KEY (constat_id, cve)
);
CREATE INDEX vulnerabilites_constat_cves_cve ON vulnerabilites_constat_cves (cve);

-- Détections : un constat sur une machine (et un port). `vu_numero` : numéro de la dernière synchronisation qui l'a vue.
CREATE TABLE vulnerabilites_detections (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  constat_id         uuid NOT NULL REFERENCES vulnerabilites_constats(id) ON DELETE CASCADE,
  machine_id         uuid NOT NULL REFERENCES vulnerabilites_machines(id) ON DELETE CASCADE,
  port               integer NOT NULL CHECK (port BETWEEN 0 AND 65535),
  protocole          text NOT NULL CHECK (protocole ~ '^[A-Z0-9]{1,10}$'),
  premiere_detection timestamptz,
  derniere_detection timestamptz,
  attenue            boolean NOT NULL DEFAULT false,
  risque_accepte     boolean NOT NULL DEFAULT false,
  risque_requalifie  boolean NOT NULL DEFAULT false,
  vu_numero          integer NOT NULL CHECK (vu_numero > 0),
  vu_le              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (constat_id, machine_id, port, protocole)
);
CREATE INDEX vulnerabilites_detections_machine ON vulnerabilites_detections (machine_id);

-- État des synchronisations d'une instance : créneau du jour (Europe/Paris) consommé avant l'inscription planifiée, dernier
-- numéro attribué, numéro de la dernière synchronisation complète (qui fait foi pour la présence), dernier état de
-- l'inventaire des machines (accès annoncé expérimental ; son échec n'empêche pas la synchronisation des failles).
CREATE TABLE vulnerabilites_tenable_etat (
  integration_id    uuid PRIMARY KEY REFERENCES integrations(id) ON DELETE CASCADE,
  creneau           date,
  numero            integer NOT NULL DEFAULT 0 CHECK (numero >= 0),
  numero_complet    integer NOT NULL DEFAULT 0 CHECK (numero_complet >= 0 AND numero_complet <= numero),
  complete_le       timestamptz,
  inventaire_ok     boolean,
  inventaire_erreur text CHECK (inventaire_erreur IS NULL OR (char_length(inventaire_erreur) BETWEEN 1 AND 300 AND inventaire_erreur !~ '[[:cntrl:]]')),
  inventaire_le     timestamptz,
  CHECK ((inventaire_ok IS NULL) = (inventaire_le IS NULL)),
  CHECK (inventaire_erreur IS NULL OR inventaire_ok = false)
);

-- Journal des synchronisations (une par exécution « synchroniser ») : numéro attribué à la réclamation, lots et éléments
-- reçus, complète ou non. Le bilan lui-même est le résultat de l'exécution (integration_executions.resultat).
CREATE TABLE vulnerabilites_synchronisations (
  execution_id   uuid PRIMARY KEY REFERENCES integration_executions(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  numero         integer NOT NULL CHECK (numero > 0),
  lots           integer NOT NULL DEFAULT 0 CHECK (lots BETWEEN 0 AND 200),
  elements       integer NOT NULL DEFAULT 0 CHECK (elements BETWEEN 0 AND 100000),
  complete       boolean NOT NULL DEFAULT false,
  UNIQUE (integration_id, numero)
);
