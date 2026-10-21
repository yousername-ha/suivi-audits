-- Journaux techniques (012-13) : niveau de journalisation du serveur, réglable à chaud depuis l'administration.
-- `niveau` : seuil permanent (info ou warn ; les erreurs sont toujours collectées). `debug_jusqua` : le niveau debug ne
-- s'applique que jusqu'à cette date, puis le seuil permanent reprend. Une seule ligne, créée à la première modification ;
-- sans ligne, le niveau de l'environnement (LOG_LEVEL) reste en vigueur. Le journal d'audit est indépendant.
CREATE TABLE IF NOT EXISTS journal_technique_config (
  id smallint PRIMARY KEY CHECK (id = 1),
  niveau text NOT NULL DEFAULT 'info' CHECK (niveau IN ('info', 'warn')),
  debug_jusqua timestamptz,
  modifie_par text NOT NULL DEFAULT '',
  modifie_le timestamptz NOT NULL DEFAULT now()
);
