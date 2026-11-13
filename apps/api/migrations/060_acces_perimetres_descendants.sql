-- ADR 0092 (amende l'ADR 0039) : un compte rattaché à un périmètre voit ce périmètre et ses descendants, rien d'autre.
-- Un compte sans aucun rattachement garde l'accès aux périmètres ouverts à toute l'organisation (visibilité « instance »).
-- Fonctions pures de lecture : aucune donnée n'est modifiée ; une version antérieure ignore ces fonctions.

CREATE OR REPLACE FUNCTION grc_smsi_ascendance(s uuid) RETURNS TABLE(id uuid)
LANGUAGE sql STABLE AS $$
  WITH RECURSIVE a(id, parent_id, n) AS (
    SELECT g.id, g.parent_id, 0 FROM grc_smsis g WHERE g.id = s
    UNION ALL
    SELECT g.id, g.parent_id, a.n + 1 FROM grc_smsis g JOIN a ON g.id = a.parent_id WHERE a.n < 10
  )
  SELECT a.id FROM a
$$;

-- Compte administrateur de l'installation (rôle attribué directement ou par un groupe, comme `Grc.isAdmin`).
CREATE OR REPLACE FUNCTION grc_est_admin(u uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u AND ur.role_id = 'administrateur'
                   AND (ur.modules IS NULL OR 'administration' = ANY (ur.modules)))
      OR EXISTS (SELECT 1 FROM user_groups ug JOIN group_roles gr ON gr.group_id = ug.group_id
                  WHERE ug.user_id = u AND gr.role_id = 'administrateur')
$$;

-- Le compte est-il rattaché au périmètre, ou à l'un de ses ancêtres ? (écriture : au moins un rattachement en écriture)
CREATE OR REPLACE FUNCTION grc_smsi_rattache(u uuid, s uuid, ecriture boolean) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM grc_members m
    WHERE m.user_id = u AND m.smsi_id IN (SELECT id FROM grc_smsi_ascendance(s)) AND (NOT ecriture OR m.can_write)
  )
$$;

-- Le compte peut-il ouvrir le périmètre (hors administrateur) ? Rattaché : ce périmètre et ses descendants.
-- Sans aucun rattachement : les périmètres de visibilité « instance ».
CREATE OR REPLACE FUNCTION grc_smsi_ouvert(u uuid, s uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT grc_est_admin(u) OR grc_smsi_rattache(u, s, false)
    OR (EXISTS (SELECT 1 FROM grc_smsis g WHERE g.id = s AND g.visibility = 'instance')
        AND NOT EXISTS (SELECT 1 FROM grc_members m WHERE m.user_id = u))
$$;

-- Le compte peut-il écrire dans le périmètre (hors administrateur) ?
CREATE OR REPLACE FUNCTION grc_smsi_ecrivable(u uuid, s uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT grc_est_admin(u) OR grc_smsi_rattache(u, s, true)
    OR (EXISTS (SELECT 1 FROM grc_smsis g WHERE g.id = s AND g.visibility = 'instance')
        AND NOT EXISTS (SELECT 1 FROM grc_members m WHERE m.user_id = u))
$$;
