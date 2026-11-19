-- Module Vulnérabilités (ADR 0100, lot S1 ; décision du RSSI du 18/11/2026) : délais de correction et exceptions à échéance.
-- Migration additive : colonnes nouvelles (toutes facultatives) sur le suivi et son historique, une contrainte de l'historique
-- recréée avec un événement de plus, une table nouvelle, la contrainte de portée des notifications recréée avec deux types
-- de plus et un index ; aucune donnée reprise ni modifiée (consigne du 14/11/2026). Les délais cibles par priorité sont
-- rangés avec les seuils de priorité (table `settings`, clé `vulnerabilites:priorite`) : aucune donnée de départ ici, les
-- valeurs par défaut sont portées par le code.
-- - Exception (risque accepté) : la date de revue du lot V4b (`revue_le`) devient l'échéance de l'exception ; justification
--   (copie de la note de la décision, gardée aussi à l'historique), mesure compensatoire, auteur et date de la décision, état
--   d'avant l'exception (rendu à l'expiration), date du rappel. Ces colonnes sont vides hors risque accepté. Une exception
--   enregistrée avant ce lot les a vides : elle reste valide, signalée « sans échéance, à compléter » si elle n'a pas de date.
-- - `delai_repart_le` : reprise du délai de correction (fin d'une exception, réapparition d'une faille corrigée).
-- - Historique (en ajout seul, déclencheurs inchangés) : mesure compensatoire d'une exception ; priorité, point de départ,
--   fin et échéance du délai relevés au passage à « corrigée » (mesure des délais) ; événement « expiration ».
-- - `vulnerabilites_depassements` : failles déjà signalées en dépassement (une notification de résumé ne compte que les
--   nouvelles) ; recalculée à chaque évaluation, sans clé étrangère (une faille effacée en sort à l'évaluation suivante).
-- Remise à vide (apps/api/src/remise-a-vide.ts) : la table nouvelle avec le travail.

ALTER TABLE vulnerabilites_suivis
  ADD COLUMN exception_justification text
    CHECK (exception_justification IS NULL OR char_length(exception_justification) BETWEEN 1 AND 1000),
  ADD COLUMN exception_mesure text CHECK (exception_mesure IS NULL OR char_length(exception_mesure) BETWEEN 1 AND 1000),
  ADD COLUMN exception_par text CHECK (exception_par IS NULL OR char_length(exception_par) BETWEEN 1 AND 200),
  ADD COLUMN exception_le timestamptz,
  ADD COLUMN exception_etat_avant text CHECK (exception_etat_avant IS NULL
    OR exception_etat_avant IN ('nouvelle', 'a_traiter', 'en_cours', 'corrigee', 'risque_accepte', 'non_concernee')),
  ADD COLUMN exception_rappel_le timestamptz,
  ADD COLUMN delai_repart_le timestamptz;
ALTER TABLE vulnerabilites_suivis
  ADD CONSTRAINT vulnerabilites_suivis_exception CHECK (etat = 'risque_accepte' OR (exception_justification IS NULL
    AND exception_mesure IS NULL AND exception_par IS NULL AND exception_le IS NULL AND exception_etat_avant IS NULL
    AND exception_rappel_le IS NULL));
CREATE INDEX vulnerabilites_suivis_exceptions ON vulnerabilites_suivis (revue_le) WHERE etat = 'risque_accepte';

ALTER TABLE vulnerabilites_suivi_historique
  ADD COLUMN mesure text CHECK (mesure IS NULL OR char_length(mesure) BETWEEN 1 AND 1000),
  ADD COLUMN priorite text CHECK (priorite IS NULL OR priorite IN ('P1', 'P2', 'P3', 'P4')),
  ADD COLUMN delai_depuis timestamptz,
  ADD COLUMN delai_fin timestamptz,
  ADD COLUMN delai_echeance timestamptz;
ALTER TABLE vulnerabilites_suivi_historique DROP CONSTRAINT vulnerabilites_suivi_historique_evenement_check;
ALTER TABLE vulnerabilites_suivi_historique
  ADD CONSTRAINT vulnerabilites_suivi_historique_evenement_check CHECK (evenement IN ('changement', 'action',
    'proposition', 'refus', 'retrait_proposition', 'reapparition', 'expiration'));
CREATE INDEX vulnerabilites_suivi_historique_corrigees ON vulnerabilites_suivi_historique (cree_le)
  WHERE evenement = 'changement' AND etat_apres = 'corrigee';
CREATE INDEX vulnerabilites_suivi_historique_expirations ON vulnerabilites_suivi_historique (cree_le)
  WHERE evenement = 'expiration';

CREATE TABLE vulnerabilites_depassements (
  nature     text NOT NULL CHECK (nature IN ('constat', 'declaree')),
  objet_id   uuid NOT NULL,
  priorite   text NOT NULL CHECK (priorite IN ('P1', 'P2', 'P3', 'P4')),
  echeance   timestamptz NOT NULL,
  signale_le timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (nature, objet_id)
);

-- Notifications métier du lot S1 (types vulnerabilites_delais et vulnerabilites_exceptions) : ni SMSI ni objet du socle,
-- comme les alertes du lot V6 ; un résumé par personne et par évaluation (clé « delais:<évaluation> » ou
-- « exceptions:<évaluation> »).
ALTER TABLE grc_notifications DROP CONSTRAINT IF EXISTS grc_notifications_portee;
ALTER TABLE grc_notifications
  ADD CONSTRAINT grc_notifications_portee
  CHECK (kind IN ('alerte_securite', 'retex_contribution', 'vulnerabilites_alerte_critique', 'vulnerabilites_alerte',
                  'vulnerabilites_delais', 'vulnerabilites_exceptions')
         OR (smsi_id IS NOT NULL AND object_id IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS grc_notifications_vulnerabilites_delais
  ON grc_notifications (user_id, due_key) WHERE kind IN ('vulnerabilites_delais', 'vulnerabilites_exceptions');
