-- Pyramide des périmètres (décision du RSSI du 13/11/2026, ADR 0092, lot 1) : l'accès donné sur un périmètre vaut pour tous
-- ses descendants. Amende le point 4 de l'ADR 0039 (« droits et membres ne se propagent pas ») pour les seuls membres.
-- Migration additive : aucune ligne de grc_members n'est créée, modifiée ni supprimée ; l'héritage est calculé à la lecture.
-- Résultat : NULL sans accès ; false en lecture seule ; true si le compte a l'écriture sur le périmètre ou sur l'un de ses
-- ancêtres (le niveau le plus élevé de la chaîne l'emporte). La profondeur est bornée comme le garde-fou de la migration 022.
CREATE OR REPLACE FUNCTION grc_acces_perimetre(p_smsi uuid, p_user uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  WITH RECURSIVE amont(id, parent_id, profondeur) AS (
    SELECT s.id, s.parent_id, 0 FROM grc_smsis s WHERE s.id = p_smsi
    UNION ALL
    SELECT s.id, s.parent_id, a.profondeur + 1 FROM grc_smsis s JOIN amont a ON s.id = a.parent_id WHERE a.profondeur < 64
  )
  SELECT bool_or(m.can_write) FROM amont a JOIN grc_members m ON m.smsi_id = a.id WHERE m.user_id = p_user
$$;
