-- ADR 0095 (amende l'ADR 0092) : un périmètre n'est visible que par un compte qui y a accès, par rattachement au périmètre
-- ou à l'un de ses ancêtres (pyramide de l'ADR 0092), ou par le rôle d'administrateur. Le périmètre commun, de visibilité
-- « instance », n'échappe plus à la règle : un compte sans rattachement ne voit rien, un compte rattaché à un enfant ne voit
-- que ce périmètre et ses descendants, un compte rattaché à la racine garde tout (décision du RSSI du 14/11/2026).
-- Fonctions pures de lecture : aucune donnée n'est modifiée ; une version antérieure les ignore.

-- Compte administrateur de l'installation (rôle attribué directement ou par un groupe, comme `Grc.isAdmin`).
CREATE OR REPLACE FUNCTION grc_est_admin(u uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u AND ur.role_id = 'administrateur'
                   AND (ur.modules IS NULL OR 'administration' = ANY (ur.modules)))
      OR EXISTS (SELECT 1 FROM user_groups ug JOIN group_roles gr ON gr.group_id = ug.group_id
                  WHERE ug.user_id = u AND gr.role_id = 'administrateur')
$$;

-- Le compte voit-il le périmètre ? Administrateur : tous ; sinon rattachement au périmètre ou à un ancêtre.
CREATE OR REPLACE FUNCTION grc_smsi_visible(s uuid, u uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT grc_est_admin(u) OR grc_acces_perimetre(s, u) IS NOT NULL
$$;
