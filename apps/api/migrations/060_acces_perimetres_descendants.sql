-- ADR 0092 (amende l'ADR 0039) : un compte rattaché à un périmètre voit ce périmètre et ses descendants, rien d'autre.
-- Un compte sans aucun rattachement ne voit aucun périmètre (décision du RSSI du 13/11/2026). Pour que la mise à jour ne
-- retire l'accès à personne, chaque compte existant sans rattachement est rattaché au périmètre commun, en écriture (ce
-- que lui donnait la visibilité « instance » ; ses rôles continuent de borner ses droits).
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
CREATE OR REPLACE FUNCTION grc_smsi_ouvert(u uuid, s uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT grc_est_admin(u) OR grc_smsi_rattache(u, s, false)
$$;

-- Le compte peut-il écrire dans le périmètre (hors administrateur) ?
CREATE OR REPLACE FUNCTION grc_smsi_ecrivable(u uuid, s uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT grc_est_admin(u) OR grc_smsi_rattache(u, s, true)
$$;

INSERT INTO grc_members (smsi_id, user_id, can_write)
SELECT '00000000-0000-4000-8000-000000000001', u.id, true
FROM users u
WHERE EXISTS (SELECT 1 FROM grc_smsis WHERE id = '00000000-0000-4000-8000-000000000001')
  AND NOT EXISTS (SELECT 1 FROM grc_members m WHERE m.user_id = u.id)
ON CONFLICT DO NOTHING;
