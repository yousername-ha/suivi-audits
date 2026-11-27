-- Matrice « Qui décide quoi » des rôles et responsabilités (ADR 0115 ; décision du RSSI du 27/11/2026) : pour chaque
-- périmètre, au plus une matrice « décisions × rôles », dont chaque case porte R, A, C ou I (case vide : absente).
-- Même grille et même règle que la matrice RACI des fournisseurs (ADR 0113, migration 106).
-- Contenu (contrôlé par l'API, schéma MatriceDecisionsBody de packages/shared/src/raci-decisions.ts, et ici pour la forme) :
--   decisions : tableau d'au plus 60 objets { id, libelle } (mêmes règles que les activités de la migration 106 :
--               identifiants en minuscules, chiffres et tirets, 40 caractères au plus ; libellés de 1 à 200 caractères,
--               sans caractère de contrôle), saisis librement, aucun au départ ;
--   cases     : tableau d'au plus 3000 objets { decision, role, lettre } ; `role` est la référence d'une fiche du registre
--               « Rôles et responsabilités » (« object:<uuid> », ou « legacy:roles:<id> » au périmètre commun), sans
--               copie de son libellé (ADR 0083). Les références des cases vers les lignes et les rôles du registre sont
--               contrôlées par l'API.
-- Les colonnes ne sont pas enregistrées : ce sont les rôles du registre, lus à chaque lecture. Un rôle retiré du registre
-- garde ses lettres (colonne « Rôle retiré ») ; le contrôle des relations signale une référence introuvable.
-- Concurrence : version et If-Match. Journal : périmètre, nombres de lignes et de colonnes seulement.
-- Suppression du périmètre : la matrice suit (ON DELETE CASCADE) ; la remise à vide l'efface avec les données de travail.
-- Migration additive, aucune donnée reprise (consigne du 14/11/2026) : une fonction et une table nouvelles, vide.

CREATE FUNCTION responsabilites_raci_cases_valides(l jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN jsonb_typeof(l) IS DISTINCT FROM 'array' THEN false ELSE (
    SELECT coalesce(bool_and(
      jsonb_typeof(e) = 'object'
      AND jsonb_typeof(e->'decision') = 'string'
      AND (e->>'decision') ~ '^[a-z0-9][a-z0-9-]{0,39}$'
      AND jsonb_typeof(e->'role') = 'string'
      AND (e->>'role') ~ '^(object:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|legacy:roles:.+)$'
      AND char_length(e->>'role') <= 220
      AND (e->>'role') !~ '[[:cntrl:]]'
      AND jsonb_typeof(e->'lettre') = 'string'
      AND (e->>'lettre') IN ('R', 'A', 'C', 'I')
    ), true)
    FROM jsonb_array_elements(l) e
  ) END
$$;

CREATE TABLE responsabilites_raci (
  smsi_id         uuid PRIMARY KEY REFERENCES grc_smsis(id) ON DELETE CASCADE,
  -- Même forme que les activités de la matrice des fournisseurs : la fonction de la migration 106 est réutilisée.
  decisions       jsonb NOT NULL
                  CHECK (fournisseurs_raci_elements_valides(decisions) AND jsonb_array_length(decisions) <= 60),
  cases           jsonb NOT NULL
                  CHECK (responsabilites_raci_cases_valides(cases) AND jsonb_array_length(cases) <= 3000),
  version         integer NOT NULL DEFAULT 1 CHECK (version > 0),
  mise_a_jour_le  timestamptz NOT NULL DEFAULT now(),
  mise_a_jour_par text NOT NULL CHECK (char_length(mise_a_jour_par) BETWEEN 1 AND 200)
);
