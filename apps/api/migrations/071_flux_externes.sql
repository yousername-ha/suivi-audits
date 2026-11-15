-- Flux réseau vers l'extérieur pilotés par les modules (ADR 0097, lot 1) : état voulu, décidé par l'administrateur, et état
-- appliqué, rapporté par l'exécutant d'exploitation. Une ligne par module décidé ou appliqué ; l'absence de ligne vaut
-- « fermé ». Les modules eux-mêmes sont décrits par le registre partagé (packages/shared/src/flux-externes.ts) : la base
-- n'en fige pas la liste, un module futur n'exige pas de migration. Table de configuration, jamais effacée par une remise à
-- vide. Additive, sans reprise de données : une installation neuve comme un serveur déjà installé démarre tous flux fermés.
CREATE TABLE flux_externes (
  module text PRIMARY KEY CHECK (module ~ '^[a-z][a-z0-9-]{1,39}$'),
  ouvert boolean NOT NULL DEFAULT false,
  decide_par text,
  decide_le timestamptz,
  applique text CHECK (applique IN ('ouvert', 'ferme', 'erreur')),
  applique_le timestamptz,
  erreur text CHECK (char_length(erreur) BETWEEN 1 AND 300),
  CHECK ((decide_par IS NULL) = (decide_le IS NULL)),
  CHECK ((applique IS NULL) = (applique_le IS NULL)),
  -- Une erreur accompagne l'état appliqué « erreur », et lui seul.
  CHECK (CASE WHEN applique = 'erreur' THEN erreur IS NOT NULL ELSE erreur IS NULL END)
);
