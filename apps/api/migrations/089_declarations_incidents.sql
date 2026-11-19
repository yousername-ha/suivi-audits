-- Déclaration réglementaire des incidents (ADR 0105, décisions du RSSI du 18/11/2026) : déclarations santé (CERT Santé, ARS)
-- et NIS 2 (ANSSI) d'un incident, date de qualification de l'incident, rappels.
-- Migration additive : une table nouvelle, une colonne nullable sur suivi_incidents, une contrainte recréée à l'identique plus
-- un type, un index. Aucune reprise de données (consigne du 14/11/2026) : les incidents existants n'ont pas de date de
-- qualification et ne reçoivent aucune proposition rétroactive.
-- Remise à vide (apps/api/src/remise-a-vide.ts) : la table avec le travail ; seul ce chemin efface une déclaration figée
-- (déclencheurs suspendus le temps de la transaction).

-- Date et heure (ISO) du premier passage de l'incident à « Incident de sécurité » (champ `qualifiedAt` de l'état historique,
-- correspondance dans apps/api/src/historique/tables/collections.ts) ; NULL = champ absent.
ALTER TABLE suivi_incidents ADD COLUMN qualified_at text;

-- Une déclaration par régime et par étape d'un incident, plus les compléments liés à une déclaration envoyée. L'incident est
-- repéré par son identifiant (INC-AAAA-nnn) et son périmètre, sans clé étrangère : les lignes de suivi_incidents sont
-- réécrites à chaque enregistrement de l'état historique.
-- `rubriques` : rubriques saisies du brouillon (clé → texte) ; une rubrique absente suit la fiche de l'incident.
-- `reference` : numéro de dossier pressenti, puis numéro de dossier ou d'accusé de réception à l'envoi.
-- `contenu` : texte transmis, figé à l'envoi (liste de rubriques avec leur libellé, leur source et leur texte).
-- `depart`, `echeance` : calculés par le serveur (qualification + 24 h ou 72 h ; rapport final : envoi de la notification
-- + un mois ; santé : pas d'échéance chiffrée).
CREATE TABLE incidents_declarations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id  text NOT NULL CHECK (char_length(incident_id) BETWEEN 1 AND 64),
  smsi_id      uuid NOT NULL,
  regime       text NOT NULL CHECK (regime IN ('sante', 'nis2')),
  etape        text NOT NULL
                 CHECK (etape IN ('signalement', 'alerte_precoce', 'notification', 'rapport_final', 'complement')),
  liee_a       uuid REFERENCES incidents_declarations (id),
  origine      text NOT NULL CHECK (origine IN ('proposition', 'manuelle', 'complement')),
  statut       text NOT NULL CHECK (statut IN ('proposee', 'a_declarer', 'non_requise', 'envoyee')),
  depart       timestamptz,
  echeance     timestamptz,
  rubriques    jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(rubriques) = 'object'),
  reference    text NOT NULL DEFAULT '' CHECK (char_length(reference) <= 200 AND reference !~ '[[:cntrl:]]'),
  motif        text CHECK (motif IS NULL OR char_length(btrim(motif)) BETWEEN 1 AND 2000),
  decide_par   text CHECK (decide_par IS NULL OR char_length(decide_par) BETWEEN 1 AND 200),
  decide_le    timestamptz,
  envoyee_par  text CHECK (envoyee_par IS NULL OR char_length(envoyee_par) BETWEEN 1 AND 200),
  envoyee_le   timestamptz,
  contenu      jsonb CHECK (contenu IS NULL OR jsonb_typeof(contenu) = 'array'),
  version      integer NOT NULL DEFAULT 1 CHECK (version > 0),
  cree_le      timestamptz NOT NULL DEFAULT now(),
  cree_par     text NOT NULL CHECK (char_length(cree_par) BETWEEN 1 AND 200),
  maj_le       timestamptz NOT NULL DEFAULT now(),
  maj_par      text NOT NULL CHECK (char_length(maj_par) BETWEEN 1 AND 200),
  -- Santé : signalement ; NIS 2 : alerte précoce, notification, rapport final ; complément pour les deux.
  CHECK (etape = 'complement' OR (regime = 'sante') = (etape = 'signalement')),
  CHECK ((etape = 'complement') = (liee_a IS NOT NULL) AND (etape = 'complement') = (origine = 'complement')),
  CHECK ((statut = 'non_requise') = (motif IS NOT NULL)),
  CHECK ((statut IN ('non_requise', 'envoyee')) <= (decide_le IS NOT NULL AND decide_par IS NOT NULL)),
  CHECK ((statut = 'envoyee') = (envoyee_le IS NOT NULL AND envoyee_par IS NOT NULL AND contenu IS NOT NULL)),
  CHECK (statut <> 'envoyee' OR char_length(btrim(reference)) >= 1)
);
CREATE INDEX incidents_declarations_incident ON incidents_declarations (incident_id, cree_le);
CREATE INDEX incidents_declarations_ouvertes ON incidents_declarations (statut) WHERE statut IN ('proposee', 'a_declarer');

-- Une déclaration envoyée ou écartée « non requise » est la preuve de la décision : ni modifiable ni supprimable, même
-- directement en SQL (modèle des rôles prédéfinis, 003) ; aucune troncature (modèle des historiques en ajout seul, 077).
CREATE FUNCTION incidents_declarations_figees() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.statut IN ('envoyee', 'non_requise') THEN
    RAISE EXCEPTION 'Déclaration d''incident figée (%) : ni modifiable ni supprimable', OLD.statut;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER incidents_declarations_figees BEFORE UPDATE OR DELETE ON incidents_declarations
  FOR EACH ROW EXECUTE FUNCTION incidents_declarations_figees();
CREATE TRIGGER incidents_declarations_no_truncate BEFORE TRUNCATE ON incidents_declarations
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();

-- Rappels de déclaration (type incident_declaration) : ni SMSI ni objet du socle, comme les alertes de sécurité (046), les
-- contributions RETEX (049), les alertes (086) et les résumés de délais et d'exceptions (087) du module Vulnérabilités ; la
-- contrainte de portée est recréée à l'identique de 087 plus ce type (rien d'autre ne change). Une seule notification par
-- personne et par jalon (clé « <déclaration>:<jalon>:<départ> »).
ALTER TABLE grc_notifications DROP CONSTRAINT IF EXISTS grc_notifications_portee;
ALTER TABLE grc_notifications
  ADD CONSTRAINT grc_notifications_portee
  CHECK (kind IN ('alerte_securite', 'retex_contribution', 'vulnerabilites_alerte_critique', 'vulnerabilites_alerte',
                  'vulnerabilites_delais', 'vulnerabilites_exceptions', 'incident_declaration')
         OR (smsi_id IS NOT NULL AND object_id IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS grc_notifications_incident_declaration
  ON grc_notifications (user_id, due_key) WHERE kind = 'incident_declaration';
