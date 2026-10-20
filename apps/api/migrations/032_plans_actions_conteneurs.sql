-- Plan d'actions comme conteneur : un registre de la famille « plan d'actions » porte des dates, un statut et un
-- responsable (personne, groupe ou fonction) ; ses actions sont ordonnées (colonne « rang » de la fiche).
-- Migration additive : aucune donnée existante n'est modifiée ; les plans existants restent « prévus », sans date ni
-- responsable, et leurs actions gardent leur ordre d'affichage actuel (rang vide : après les actions ordonnées).
ALTER TABLE registres
  ADD COLUMN date_debut  date,
  ADD COLUMN date_fin    date,
  ADD COLUMN statut      text NOT NULL DEFAULT 'prevu' CHECK (statut IN ('prevu', 'en_cours', 'termine', 'abandonne')),
  ADD COLUMN responsable jsonb,
  ADD CONSTRAINT registres_dates_coherentes CHECK (date_debut IS NULL OR date_fin IS NULL OR date_debut <= date_fin);
ALTER TABLE grc_objects ADD COLUMN rang integer;
CREATE INDEX grc_objects_registre_rang ON grc_objects (registre_id, rang) WHERE registre_id IS NOT NULL;
