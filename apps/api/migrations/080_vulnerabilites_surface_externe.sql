-- Module Vulnérabilités (ADR 0100, lot ALH1) : surface externe lue dans AlgoLightHouse (ALH, éditeur AlgoSecure) par
-- l'opération « synchroniser » du connecteur « algolighthouse » (module Intégrations, ADR 0076). Migration additive : tables
-- nouvelles seulement, aucune table existante modifiée. Sans reprise de données (consigne du 14/11/2026).
-- Lecture seule : rien n'est jamais écrit chez l'éditeur. Ne sont jamais rangés : description HTML des alertes (« note »),
-- commentaires, pièces jointes, données sensibles des fragments, contacts.
-- Présence : comme pour Tenable (075), chaque élément garde le numéro de la dernière synchronisation qui l'a vu ; seule une
-- synchronisation complète fait foi. Rien n'est supprimé quand un élément disparaît : il n'est plus listé.
-- Droits : chaque élément hérite du périmètre de la plateforme relié à son périmètre ALH (table des liaisons) ; un périmètre
-- ALH non relié n'est lisible qu'avec vulnerabilites:administrer (ADR 0100, point 14, même règle que les machines).
-- Remise à vide (apps/api/src/remise-a-vide.ts) : périmètres ALH et liaisons, actifs, alertes, technologies avec le travail
-- (données relues à la synchronisation suivante, liaison saisie par les utilisateurs et rattachée à grc_smsis) ; état des
-- synchronisations par instance et journal des synchronisations avec la configuration, comme les instances.

-- Périmètres ALH et leur liaison à un périmètre de la plateforme (NULL : non relié). `version` ne change qu'avec la liaison
-- (If-Match) ; une synchronisation ne la touche pas.
CREATE TABLE vulnerabilites_alh_perimetres (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  alh_id         uuid NOT NULL,
  nom            text NOT NULL CHECK (char_length(nom) BETWEEN 1 AND 200 AND nom !~ '[[:cntrl:]]'),
  perimetre_id   uuid REFERENCES grc_smsis(id) ON DELETE SET NULL,
  vu_numero      integer NOT NULL CHECK (vu_numero > 0),
  version        integer NOT NULL DEFAULT 1 CHECK (version > 0),
  cree_le        timestamptz NOT NULL DEFAULT now(),
  maj_le         timestamptz NOT NULL DEFAULT now(),
  maj_par        text,
  UNIQUE (integration_id, alh_id)
);
CREATE INDEX vulnerabilites_alh_perimetres_perimetre ON vulnerabilites_alh_perimetres (perimetre_id);

-- Actifs de la cartographie : hôtes (adresse IP) et domaines. `perimetre_alh` : identifiant ALH du périmètre (peut manquer).
CREATE TABLE vulnerabilites_alh_actifs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  type           text NOT NULL CHECK (type IN ('hote', 'domaine')),
  alh_id         uuid NOT NULL,
  perimetre_alh  uuid,
  statut         text CHECK (statut IS NULL OR statut IN ('new', 'monitored', 'ignored', 'pending-approval', 'provider')),
  valeur         text NOT NULL CHECK (char_length(valeur) BETWEEN 1 AND 253 AND valeur ~ '^[a-z0-9_*:.-]+$'),
  adresse        text CHECK (adresse IS NULL OR (char_length(adresse) <= 45 AND adresse ~ '^[0-9a-f:.]+$')),
  fai            text CHECK (fai IS NULL OR (char_length(fai) BETWEEN 1 AND 200 AND fai !~ '[[:cntrl:]]')),
  asn            text CHECK (asn IS NULL OR asn ~ '^[0-9]{1,10}$'),
  pays           text CHECK (pays IS NULL OR pays ~ '^[A-Z]{2}$'),
  mutualise      boolean,
  cdn            boolean,
  joignable      boolean,
  joignable_le   timestamptz,
  niveau         smallint CHECK (niveau IS NULL OR niveau BETWEEN 1 AND 127),
  import_manuel  boolean,
  parent_alh     uuid,
  cree_alh_le    timestamptz,
  maj_alh_le     timestamptz,
  vu_numero      integer NOT NULL CHECK (vu_numero > 0),
  vu_le          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, type, alh_id),
  -- Un hôte n'a ni niveau ni parent ; sa valeur est son adresse.
  CHECK (type = 'domaine' OR (niveau IS NULL AND parent_alh IS NULL))
);
CREATE INDEX vulnerabilites_alh_actifs_perimetre ON vulnerabilites_alh_actifs (integration_id, perimetre_alh);
CREATE INDEX vulnerabilites_alh_actifs_valeur ON vulnerabilites_alh_actifs (valeur);

-- Alertes approuvées par les analystes de l'éditeur. Type, criticité, cible et CVE viennent du détail (lu pour les plus
-- récentes ; `detail` : lu au moins une fois). Statut de l'éditeur lu, jamais modifié.
CREATE TABLE vulnerabilites_alh_alertes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  alh_id         uuid NOT NULL,
  perimetre_alh  uuid,
  type           text CHECK (type IS NULL OR type IN ('vulnerable_service', 'exposed_service', 'config_defect', 'data_leak', 'typosquatting')),
  criticite      text CHECK (criticite IS NULL OR criticite IN ('critical', 'major', 'important', 'minor')),
  statut         text NOT NULL CHECK (statut IN ('untreated', 'in-progress', 'to-retest', 'to-reprocess', 'standbye', 'completed', 'abandoned', 'accepted-risk')),
  titre          text NOT NULL CHECK (char_length(titre) BETWEEN 1 AND 300 AND titre !~ '[[:cntrl:]]'),
  verifiee       boolean,
  detail         boolean NOT NULL DEFAULT false,
  cible_type     text CHECK (cible_type IS NULL OR cible_type IN ('domain', 'host', 'service', 'keyword')),
  cible_valeur   text CHECK (cible_valeur IS NULL OR (char_length(cible_valeur) BETWEEN 1 AND 300 AND cible_valeur !~ '[[:cntrl:]]')),
  cible_hote     uuid,
  cible_domaine  uuid,
  cree_alh_le    timestamptz,
  maj_alh_le     timestamptz,
  terminee_le    timestamptz,
  vu_numero      integer NOT NULL CHECK (vu_numero > 0),
  vu_le          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, alh_id)
);
CREATE INDEX vulnerabilites_alh_alertes_perimetre ON vulnerabilites_alh_alertes (integration_id, perimetre_alh);

-- CVE d'une alerte (200 au plus par alerte, contrôlé par l'API), remplacées à chaque lecture du détail.
CREATE TABLE vulnerabilites_alh_alerte_cves (
  alerte_id uuid NOT NULL REFERENCES vulnerabilites_alh_alertes(id) ON DELETE CASCADE,
  cve       text NOT NULL CHECK (cve ~ '^CVE-[12][0-9]{3}-[0-9]{4,9}$'),
  PRIMARY KEY (alerte_id, cve)
);
CREATE INDEX vulnerabilites_alh_alerte_cves_cve ON vulnerabilites_alh_alerte_cves (cve);

-- Technologies détectées : une par instance et par clé (éditeur, produit, technologie). Leurs actifs et leurs CVE sont
-- remplacés à chaque synchronisation qui la relit.
CREATE TABLE vulnerabilites_alh_technologies (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  cle            text NOT NULL CHECK (char_length(cle) BETWEEN 1 AND 410 AND cle !~ '[[:cntrl:]]'),
  nom            text NOT NULL CHECK (char_length(nom) BETWEEN 1 AND 200 AND nom !~ '[[:cntrl:]]'),
  editeur        text CHECK (editeur IS NULL OR (char_length(editeur) BETWEEN 1 AND 100 AND editeur !~ '[[:cntrl:]]')),
  produit        text CHECK (produit IS NULL OR (char_length(produit) BETWEEN 1 AND 100 AND produit !~ '[[:cntrl:]]')),
  technologie    text CHECK (technologie IS NULL OR (char_length(technologie) BETWEEN 1 AND 200 AND technologie !~ '[[:cntrl:]]')),
  derniere       timestamptz,
  tronquee       boolean NOT NULL DEFAULT false,
  vu_numero      integer NOT NULL CHECK (vu_numero > 0),
  vu_le          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, cle)
);

-- Actif qui exécute une version d'une technologie (`actuel` faux : actif où elle n'est plus détectée). Le droit de lecture
-- passe par l'actif rangé (même identifiant ALH) et son périmètre ; un actif inconnu ne se lit qu'avec administrer.
CREATE TABLE vulnerabilites_alh_technologie_actifs (
  technologie_id uuid NOT NULL REFERENCES vulnerabilites_alh_technologies(id) ON DELETE CASCADE,
  version        text NOT NULL CHECK (char_length(version) <= 100 AND version !~ '[[:cntrl:]]'),
  actif_alh      uuid NOT NULL,
  actif_type     text NOT NULL CHECK (actif_type IN ('hote', 'domaine')),
  libelle        text NOT NULL CHECK (char_length(libelle) BETWEEN 1 AND 300 AND libelle !~ '[[:cntrl:]]'),
  actuel         boolean NOT NULL,
  PRIMARY KEY (technologie_id, version, actif_type, actif_alh)
);
CREATE INDEX vulnerabilites_alh_technologie_actifs_actif ON vulnerabilites_alh_technologie_actifs (actif_type, actif_alh);

-- CVE d'une version d'une technologie, avec ce qu'en dit l'éditeur (score, EPSS entre 0 et 1, preuve, exploitation).
CREATE TABLE vulnerabilites_alh_technologie_cves (
  technologie_id uuid NOT NULL REFERENCES vulnerabilites_alh_technologies(id) ON DELETE CASCADE,
  version        text NOT NULL CHECK (char_length(version) <= 100 AND version !~ '[[:cntrl:]]'),
  cve            text NOT NULL CHECK (cve ~ '^CVE-[12][0-9]{3}-[0-9]{4,9}$'),
  titre          text CHECK (titre IS NULL OR (char_length(titre) BETWEEN 1 AND 300 AND titre !~ '[[:cntrl:]]')),
  cvss           numeric(3,1) CHECK (cvss IS NULL OR cvss BETWEEN 0 AND 10),
  epss           numeric(6,5) CHECK (epss IS NULL OR epss BETWEEN 0 AND 1),
  severite       text CHECK (severite IS NULL OR severite ~ '^[a-z]{1,20}$'),
  preuve         boolean,
  exploitee      boolean,
  publiee_le     timestamptz,
  PRIMARY KEY (technologie_id, version, cve)
);
CREATE INDEX vulnerabilites_alh_technologie_cves_cve ON vulnerabilites_alh_technologie_cves (cve);

-- État des synchronisations d'une instance : créneau du jour (Europe/Paris), dernier numéro attribué, numéro de la dernière
-- synchronisation complète (qui fait foi pour la présence).
CREATE TABLE vulnerabilites_alh_etat (
  integration_id uuid PRIMARY KEY REFERENCES integrations(id) ON DELETE CASCADE,
  creneau        date,
  numero         integer NOT NULL DEFAULT 0 CHECK (numero >= 0),
  numero_complet integer NOT NULL DEFAULT 0 CHECK (numero_complet >= 0 AND numero_complet <= numero),
  complete_le    timestamptz
);

-- Journal des synchronisations (une par exécution « synchroniser » d'ALH) : numéro attribué à la réclamation, lots et
-- éléments reçus, complète ou non. Le bilan lui-même est le résultat de l'exécution.
CREATE TABLE vulnerabilites_alh_synchronisations (
  execution_id   uuid PRIMARY KEY REFERENCES integration_executions(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  numero         integer NOT NULL CHECK (numero > 0),
  lots           integer NOT NULL DEFAULT 0 CHECK (lots BETWEEN 0 AND 200),
  elements       integer NOT NULL DEFAULT 0 CHECK (elements BETWEEN 0 AND 100000),
  complete       boolean NOT NULL DEFAULT false,
  UNIQUE (integration_id, numero)
);
