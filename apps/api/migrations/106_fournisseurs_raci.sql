-- Matrice RACI des fournisseurs (ADR 0113 ; décision du RSSI du 23/11/2026) : pour chaque fournisseur du registre de
-- l'organisation, au plus une matrice « activités × acteurs », dont chaque case porte R, A, C ou I (case vide : absente).
-- Le registre des fournisseurs reste celui de l'état historique (app_state, contrat figé, non modifié) : la matrice vit
-- dans une table à part, rattachée par l'identifiant du fournisseur (suppliers[].id), sans clé étrangère possible.
-- Contenu (contrôlé par l'API, schéma MatriceRaciBody de packages/shared/src/raci-fournisseurs.ts, et ici pour la forme) :
--   activites : tableau d'au plus 60 objets { id, libelle } ;
--   acteurs   : tableau d'au plus 15 objets { id, libelle } (fonctions de l'établissement ; la colonne du fournisseur,
--               présente d'office, n'y figure pas : ses cases portent l'acteur réservé « fournisseur ») ;
--   cases     : tableau d'au plus 960 objets { activite, acteur, lettre } ;
--   identifiants : minuscules, chiffres et tirets, 40 caractères au plus ; libellés de 1 à 200 caractères, sans caractère
--   de contrôle. Les références des cases vers les lignes et les colonnes sont contrôlées par l'API.
-- Concurrence : version et If-Match. Journal : fournisseur et nombres de lignes et de colonnes seulement.
-- Fournisseur retiré du registre : la matrice est ignorée, signalée par le contrôle des relations et effacée si
-- l'identifiant est réattribué à un nouveau fournisseur ; la remise à vide l'efface avec les données de travail.
-- Migration additive, aucune donnée reprise (consigne du 14/11/2026) : deux fonctions et une table nouvelles, vide.

CREATE FUNCTION fournisseurs_raci_elements_valides(l jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN jsonb_typeof(l) IS DISTINCT FROM 'array' THEN false ELSE (
    SELECT coalesce(bool_and(
      jsonb_typeof(e) = 'object'
      AND jsonb_typeof(e->'id') = 'string'
      AND (e->>'id') ~ '^[a-z0-9][a-z0-9-]{0,39}$'
      AND jsonb_typeof(e->'libelle') = 'string'
      AND char_length(e->>'libelle') BETWEEN 1 AND 200
      AND (e->>'libelle') !~ '[[:cntrl:]]'
    ), true)
    FROM jsonb_array_elements(l) e
  ) END
$$;

CREATE FUNCTION fournisseurs_raci_cases_valides(l jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN jsonb_typeof(l) IS DISTINCT FROM 'array' THEN false ELSE (
    SELECT coalesce(bool_and(
      jsonb_typeof(e) = 'object'
      AND jsonb_typeof(e->'activite') = 'string'
      AND (e->>'activite') ~ '^[a-z0-9][a-z0-9-]{0,39}$'
      AND jsonb_typeof(e->'acteur') = 'string'
      AND (e->>'acteur') ~ '^[a-z0-9][a-z0-9-]{0,39}$'
      AND jsonb_typeof(e->'lettre') = 'string'
      AND (e->>'lettre') IN ('R', 'A', 'C', 'I')
    ), true)
    FROM jsonb_array_elements(l) e
  ) END
$$;

CREATE TABLE fournisseurs_raci (
  fournisseur_id  text PRIMARY KEY
                  CHECK (char_length(fournisseur_id) BETWEEN 1 AND 200 AND fournisseur_id !~ '[[:cntrl:]]'),
  activites       jsonb NOT NULL
                  CHECK (fournisseurs_raci_elements_valides(activites) AND jsonb_array_length(activites) <= 60),
  acteurs         jsonb NOT NULL
                  CHECK (fournisseurs_raci_elements_valides(acteurs) AND jsonb_array_length(acteurs) <= 15),
  cases           jsonb NOT NULL
                  CHECK (fournisseurs_raci_cases_valides(cases) AND jsonb_array_length(cases) <= 960),
  version         integer NOT NULL DEFAULT 1 CHECK (version > 0),
  mise_a_jour_le  timestamptz NOT NULL DEFAULT now(),
  mise_a_jour_par text NOT NULL CHECK (char_length(mise_a_jour_par) BETWEEN 1 AND 200)
);
