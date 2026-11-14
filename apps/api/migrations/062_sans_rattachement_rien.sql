-- ADR 0095 (amende l'ADR 0092) : un périmètre n'est visible que par un compte qui y a accès, par rattachement au périmètre
-- ou à l'un de ses ancêtres (pyramide de l'ADR 0092). Le périmètre commun, de visibilité « instance », n'échappe plus à la
-- règle : un compte sans rattachement ne voit rien, un compte rattaché à un enfant ne voit que ce périmètre et ses
-- descendants, un compte rattaché à la racine garde tout (décision du RSSI du 14/11/2026). Les administrateurs voient tout
-- (côté serveur).
-- Fonction pure de lecture : aucune donnée n'est modifiée ; une version antérieure ignore cette fonction.
CREATE OR REPLACE FUNCTION grc_smsi_visible(s uuid, u uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT grc_acces_perimetre(s, u) IS NOT NULL
$$;
