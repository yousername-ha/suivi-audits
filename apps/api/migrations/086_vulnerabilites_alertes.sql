-- Module Vulnérabilités (ADR 0100, point 21 et lot V6 ; décision du RSSI du 17/11/2026 « les alertes ensuite ») : alertes
-- décidées par la plateforme, par règle (packages/shared/src/alertes-vulnerabilites.ts), jamais par l'assistant. Évaluées à la
-- fin de chaque collecte de la veille, de chaque synchronisation de Tenable ou d'AlgoLightHouse, et après une décision qui
-- change les faits (rapprochement, liaison d'un actif, état de suivi, seuil de priorité). Aucun appel réseau.
-- - Une alerte par faille (`cle` : la CVE, ou « constat:<identifiant> » pour un constat de Tenable sans CVE) tant qu'elle
--   n'est pas close (index unique partiel) ; elle se met à jour sans se rejouer, et se clôt d'elle-même avec son motif.
-- - Niveau « critique » (P1 : exploitation avérée et présence) ou « simple » (P2, seuil à confirmer par le RSSI).
-- - Prise en compte par alerte (pas par personne), avec vulnerabilites:modifier : tracée ici (qui, quand) et au journal.
-- - Faits et nombres sans aucun nom de machine, de domaine, d'adresse ni de périmètre (les mêmes pour tout le monde, lot
--   ALH5) : chacun ne voit, à la lecture, que les nombres de ce qu'il lit.
-- Notifications : deux types de plus dans grc_notifications (ADR 0058), sans périmètre ni objet du socle, comme les alertes de
-- sécurité (046) et les contributions RETEX (049) : la contrainte de portée est recréée pour les admettre (rien d'autre ne
-- change) ; une seule notification par personne et par alerte et niveau (clé « <alerte>:<niveau> »).
-- Temps réel : déclencheur suivi_notify (identifiant et version seulement, aucun contenu).
-- Migration additive : une table nouvelle, une contrainte recréée à l'identique plus deux types, un index ; aucune donnée
-- reprise (consigne du 14/11/2026). Remise à vide (apps/api/src/remise-a-vide.ts) : avec le travail.

CREATE TABLE vulnerabilites_alertes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cle               text NOT NULL CHECK (cle ~ '^(CVE-[12][0-9]{3}-[0-9]{4,9}|constat:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'),
  cve               text CHECK (cve IS NULL OR cve ~ '^CVE-[12][0-9]{3}-[0-9]{4,9}$'),
  niveau            text NOT NULL CHECK (niveau IN ('critique', 'simple')),
  priorite          text NOT NULL CHECK (priorite IN ('P1', 'P2', 'P3', 'P4')),
  etat              text NOT NULL DEFAULT 'ouverte' CHECK (etat IN ('ouverte', 'prise_en_compte', 'close')),
  titre             text NOT NULL CHECK (char_length(titre) BETWEEN 1 AND 300 AND titre !~ '[[:cntrl:]]'),
  produit           text CHECK (produit IS NULL OR (char_length(produit) BETWEEN 1 AND 200 AND produit !~ '[[:cntrl:]]')),
  -- Faits de la priorité, présences, sources de l'exploitation et nombres globaux (FaitsAlerte, sans nom).
  faits             jsonb NOT NULL,
  empreinte         text NOT NULL CHECK (char_length(empreinte) <= 20000),
  notifiee          boolean NOT NULL DEFAULT false,
  ouverte_le        timestamptz NOT NULL DEFAULT now(),
  critique_le       timestamptz,
  maj_le            timestamptz NOT NULL DEFAULT now(),
  prise_par         text CHECK (prise_par IS NULL OR char_length(prise_par) BETWEEN 1 AND 200),
  prise_le          timestamptz,
  close_le          timestamptz,
  motif_cloture     text CHECK (motif_cloture IS NULL OR motif_cloture IN ('plus_presente', 'traitee', 'sous_le_seuil')),
  version           integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by        text NOT NULL DEFAULT 'système',
  CHECK ((cle LIKE 'CVE-%') = (cve IS NOT NULL) AND (cve IS NULL OR cve = cle)),
  CHECK ((etat = 'prise_en_compte') = (prise_le IS NOT NULL AND prise_par IS NOT NULL) OR etat = 'close'),
  CHECK ((etat = 'close') = (close_le IS NOT NULL AND motif_cloture IS NOT NULL)),
  CHECK ((niveau = 'critique') <= (critique_le IS NOT NULL))
);
CREATE UNIQUE INDEX vulnerabilites_alertes_une_ouverte ON vulnerabilites_alertes (cle) WHERE etat <> 'close';
CREATE INDEX vulnerabilites_alertes_fenetre ON vulnerabilites_alertes (critique_le DESC) WHERE etat = 'ouverte' AND niveau = 'critique';
CREATE INDEX vulnerabilites_alertes_ouverture ON vulnerabilites_alertes (ouverte_le DESC);
CREATE TRIGGER vulnerabilites_alertes_notify AFTER INSERT OR UPDATE OR DELETE ON vulnerabilites_alertes
  FOR EACH ROW EXECUTE FUNCTION suivi_notify('vulnerabilites_alertes', 'id', 'version');

-- Notifications métier du module (types vulnerabilites_alerte_critique et vulnerabilites_alerte) : ni SMSI ni objet du socle.
ALTER TABLE grc_notifications DROP CONSTRAINT IF EXISTS grc_notifications_portee;
ALTER TABLE grc_notifications
  ADD CONSTRAINT grc_notifications_portee
  CHECK (kind IN ('alerte_securite', 'retex_contribution', 'vulnerabilites_alerte_critique', 'vulnerabilites_alerte')
         OR (smsi_id IS NOT NULL AND object_id IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS grc_notifications_vulnerabilites_alerte
  ON grc_notifications (user_id, due_key) WHERE kind IN ('vulnerabilites_alerte_critique', 'vulnerabilites_alerte');
