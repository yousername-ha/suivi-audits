-- ADR 0095 (amende l'ADR 0092) : un compte sans aucun rattachement ne voit aucun périmètre, pas même un périmètre
-- « instance » (décision du RSSI du 13/11/2026). Un compte rattaché quelque part voit, en plus de ses périmètres (et de
-- leurs descendants, pyramide de l'ADR 0092), les périmètres « instance ». Les administrateurs voient tout (côté serveur).
-- Fonction pure de lecture : aucune donnée n'est modifiée ; une version antérieure ignore cette fonction.
CREATE OR REPLACE FUNCTION grc_smsi_visible(s uuid, u uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT grc_acces_perimetre(s, u) IS NOT NULL
      OR (EXISTS (SELECT 1 FROM grc_smsis g WHERE g.id = s AND g.visibility = 'instance')
          AND EXISTS (SELECT 1 FROM grc_members m WHERE m.user_id = u))
$$;
