-- Veille réglementaire, lot VR-2 (ADR 0110, décision du RSSI du 22/11/2026) : deux sources de plus, désactivées au départ.
-- - « cert-sante-actualites » : flux RSS des actualités du CERT Santé (titre, date et lien seulement, jamais de résumé) ;
-- - « legifrance » (valeur prévue par la migration 098, sans collecteur jusqu'ici) : Journal officiel lu dans le fichier
--   quotidien des données ouvertes de la DILA, filtré par sa propre liste de mots-clés (comme EUR-Lex) ; lien vers la page
--   du texte sur Légifrance, de forme exacte.
-- Migration additive : seules les contraintes de liste fermée sont recréées pour admettre ces valeurs (aucune donnée
-- touchée, aucune table ni colonne retirée). L'ANS reste sans collecteur et ne s'active pas. Concordance des listes avec le
-- code vérifiée par apps/api/test/veille-reglementaire-architecture.test.ts.

ALTER TABLE veille_reglementaire_sources DROP CONSTRAINT veille_reglementaire_sources_source_check;
ALTER TABLE veille_reglementaire_sources ADD CONSTRAINT veille_reglementaire_sources_source_check
  CHECK (source IN ('cnil', 'cepd', 'eur-lex', 'anssi', 'cert-sante-actualites', 'ans', 'legifrance'));
-- Contraintes de la migration 098 écrites sans nom sur plusieurs colonnes : noms donnés par PostgreSQL dans l'ordre de leur
-- déclaration (veille_reglementaire_sources_check, _check1 ; veille_reglementaire_publications_check1 pour le lien) ;
-- recréées avec un nom explicite. Aucun IF EXISTS : un nom inattendu fait échouer la migration plutôt que de laisser
-- l'ancienne règle en place.
ALTER TABLE veille_reglementaire_sources DROP CONSTRAINT veille_reglementaire_sources_check;
ALTER TABLE veille_reglementaire_sources ADD CONSTRAINT veille_reglementaire_sources_activation_check
  CHECK (NOT activee OR source <> 'ans');
-- Liste des mots-clés : EUR-Lex et Journal officiel, chacun la sienne (NULL : liste par défaut lue dans le code).
ALTER TABLE veille_reglementaire_sources DROP CONSTRAINT veille_reglementaire_sources_check1;
ALTER TABLE veille_reglementaire_sources ADD CONSTRAINT veille_reglementaire_sources_mots_cles_check
  CHECK (mots_cles IS NULL OR (source IN ('eur-lex', 'legifrance') AND jsonb_typeof(mots_cles) = 'array'
    AND jsonb_array_length(mots_cles) BETWEEN 1 AND 60));

ALTER TABLE veille_reglementaire_collectes DROP CONSTRAINT veille_reglementaire_collectes_source_check;
ALTER TABLE veille_reglementaire_collectes ADD CONSTRAINT veille_reglementaire_collectes_source_check
  CHECK (source IN ('cnil', 'cepd', 'eur-lex', 'anssi', 'cert-sante-actualites', 'legifrance'));

-- Publications : le résumé reste réservé à la CNIL, au CEPD et à EUR-Lex (contrainte de la migration 098, inchangée) ; lien
-- en https sur l'hôte de la source, et pour le Journal officiel la seule page d'un texte par son identifiant.
ALTER TABLE veille_reglementaire_publications DROP CONSTRAINT veille_reglementaire_publications_source_check;
ALTER TABLE veille_reglementaire_publications ADD CONSTRAINT veille_reglementaire_publications_source_check
  CHECK (source IN ('cnil', 'cepd', 'eur-lex', 'anssi', 'cert-sante-actualites', 'ans', 'legifrance'));
ALTER TABLE veille_reglementaire_publications DROP CONSTRAINT veille_reglementaire_publications_check1;
ALTER TABLE veille_reglementaire_publications ADD CONSTRAINT veille_reglementaire_publications_lien_check
  CHECK (char_length(lien) <= 500 AND lien !~ '[[:space:]<>"]' AND (
    (source = 'cnil' AND lien ~ '^https://www\.cnil\.fr/')
    OR (source = 'cepd' AND lien ~ '^https://www\.edpb\.europa\.eu/')
    OR (source = 'eur-lex' AND lien ~ '^https://eur-lex\.europa\.eu/')
    OR (source = 'anssi' AND lien ~ '^https://cyber\.gouv\.fr/')
    OR (source = 'cert-sante-actualites' AND lien ~ '^https://cyberveille\.esante\.gouv\.fr/')
    OR (source = 'legifrance' AND lien ~ '^https://www\.legifrance\.gouv\.fr/jorf/id/JORFTEXT[0-9]{12}$')));
