-- Module Vulnérabilités (ADR 0100, lot ALH6 ; décision du RSSI du 17/11/2026) : services exposés (port, protocole, produit)
-- des actifs de la surface externe lue dans AlgoLightHouse, pour la colonne « Service » de la carte « Lignes d'approche ».
-- L'éditeur ne publie pas la liste des ports ouverts d'un hôte : un service n'est connu que par les fragments du détail d'une
-- alerte (`json_data` des types `port`, `vulnerable_component` et `subdomain`), lus en liste blanche par le script de
-- l'exécutant (jamais la bannière, l'état brut ni le nom d'un sous-domaine). Aucun appel réseau nouveau.
-- Migration additive : deux tables nouvelles, aucune table existante modifiée, aucune donnée reprise (consigne du 14/11/2026).
-- Rangement : un service par instance, actif, port et protocole (protocole NULL : non communiqué par l'éditeur, jamais
-- « tcp » par défaut), relié aux alertes qui le portent. Les liens d'une alerte sont remplacés à chaque lecture de son
-- détail (comme ses CVE) ; un service qu'aucune alerte ne porte plus est supprimé à ce moment (il n'a plus de source).
-- Présence : un service n'est montré que si au moins une alerte ouverte et présente le porte (présente : vue par la dernière
-- synchronisation complète de son instance), donc seule une synchronisation complète le fait disparaître, comme le reste de
-- la surface externe. Droits : ceux de l'actif (périmètre ALH relié visible, sinon vulnerabilites:administrer).
-- Remise à vide (apps/api/src/remise-a-vide.ts) : avec le travail, comme les actifs et les alertes (relus à la
-- synchronisation suivante).

CREATE TABLE vulnerabilites_alh_services (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  actif_id       uuid NOT NULL REFERENCES vulnerabilites_alh_actifs(id) ON DELETE CASCADE,
  port           integer NOT NULL CHECK (port BETWEEN 1 AND 65535),
  protocole      text CHECK (protocole IS NULL OR protocole IN ('tcp', 'udp')),
  nom            text CHECK (nom IS NULL OR (char_length(nom) BETWEEN 1 AND 100 AND nom !~ '[[:cntrl:]]')),
  produit        text CHECK (produit IS NULL OR (char_length(produit) BETWEEN 1 AND 100 AND produit !~ '[[:cntrl:]]')),
  version        text CHECK (version IS NULL OR (char_length(version) BETWEEN 1 AND 100 AND version !~ '[[:cntrl:]]')),
  editeur        text CHECK (editeur IS NULL OR (char_length(editeur) BETWEEN 1 AND 100 AND editeur !~ '[[:cntrl:]]')),
  cpe            text CHECK (cpe IS NULL OR (char_length(cpe) BETWEEN 4 AND 300 AND cpe !~ '[[:cntrl:]]'
                                             AND lower(cpe) LIKE 'cpe:%')),
  statut_version text CHECK (statut_version IS NULL OR statut_version IN ('eol', 'outdated')),
  maj_le         timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (integration_id, actif_id, port, protocole)
);
CREATE INDEX vulnerabilites_alh_services_actif ON vulnerabilites_alh_services (actif_id);

-- Alertes qui portent un service (lien remplacé à chaque lecture du détail de l'alerte).
CREATE TABLE vulnerabilites_alh_service_alertes (
  service_id uuid NOT NULL REFERENCES vulnerabilites_alh_services(id) ON DELETE CASCADE,
  alerte_id  uuid NOT NULL REFERENCES vulnerabilites_alh_alertes(id) ON DELETE CASCADE,
  PRIMARY KEY (service_id, alerte_id)
);
CREATE INDEX vulnerabilites_alh_service_alertes_alerte ON vulnerabilites_alh_service_alertes (alerte_id);
