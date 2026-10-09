-- Suivi des audits SMSI — gestion des droits (RBAC) : rôles, groupes, attributions, expiration des comptes.
-- Remplace les trois rôles fixes admin / rw / ro (colonne users.role, supprimée après reprise).
-- Les permissions des rôles prédéfinis sont définies dans le code (packages/shared/src/permissions.ts) ;
-- seules celles des rôles personnalisés sont stockées ici.

-- ---------------------------------------------------------------- Rôles
CREATE TABLE roles (
  id          text PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9_]{1,62}$'),
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  system      boolean NOT NULL DEFAULT false,
  permissions text[] NOT NULL DEFAULT '{}',
  based_on    text,
  version     integer NOT NULL DEFAULT 1,
  created_by  text NOT NULL DEFAULT '',
  updated_by  text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX roles_name_ci ON roles (lower(name));
INSERT INTO roles (id, name, description, system) VALUES
  ('administrateur', 'Administrateur', 'Tous les droits, y compris l’administration technique.', true),
  ('rssi', 'RSSI', 'Tous les droits, sauf l’administration technique.', true),
  ('contributeur', 'Contributeur', 'Lire et modifier les modules métier, les documents et les liens.', true),
  ('lecteur', 'Lecteur', 'Lecture seule des modules métier, des documents et des liens.', true),
  ('auditeur_externe', 'Auditeur externe', 'Lecture seule des modules choisis, compte à date d’expiration.', true);

-- Un rôle prédéfini n'est ni modifiable ni supprimable, même directement en SQL.
CREATE FUNCTION roles_system_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.system THEN RAISE EXCEPTION 'Rôle prédéfini « % » : ni modifiable ni supprimable', OLD.name; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER roles_system_guard BEFORE UPDATE OR DELETE ON roles
  FOR EACH ROW EXECUTE FUNCTION roles_system_immutable();

-- ---------------------------------------------------------------- Groupes
CREATE TABLE groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  version     integer NOT NULL DEFAULT 1,
  created_by  text NOT NULL DEFAULT '',
  updated_by  text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX groups_name_ci ON groups (lower(name));

CREATE TABLE group_roles (
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  role_id  text NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, role_id)
);
CREATE TABLE user_groups (
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, group_id)
);
CREATE INDEX user_groups_group ON user_groups (group_id);

-- Attribution directe ; « modules » restreint la portée du rôle (auditeur externe : modules choisis).
CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id text NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  modules text[],
  PRIMARY KEY (user_id, role_id)
);
CREATE INDEX user_roles_role ON user_roles (role_id);

-- ---------------------------------------------------------------- Comptes : expiration, reprise des rôles v2
ALTER TABLE users ADD COLUMN expires_at timestamptz;
INSERT INTO user_roles (user_id, role_id)
  SELECT id, CASE role WHEN 'admin' THEN 'administrateur' WHEN 'rw' THEN 'contributeur' ELSE 'lecteur' END FROM users;
ALTER TABLE users DROP COLUMN role;

-- ---------------------------------------------------------------- Temps réel
CREATE TRIGGER roles_notify AFTER INSERT OR UPDATE OR DELETE ON roles
  FOR EACH ROW EXECUTE FUNCTION suivi_notify('roles', 'id', 'version');
CREATE TRIGGER groups_notify AFTER INSERT OR UPDATE OR DELETE ON groups
  FOR EACH ROW EXECUTE FUNCTION suivi_notify('groups', 'id', 'version');
CREATE TRIGGER group_roles_notify AFTER INSERT OR DELETE ON group_roles
  FOR EACH ROW EXECUTE FUNCTION suivi_notify('groups', 'group_id', '');
CREATE TRIGGER user_groups_notify AFTER INSERT OR DELETE ON user_groups
  FOR EACH ROW EXECUTE FUNCTION suivi_notify('users', 'user_id', '');
CREATE TRIGGER user_roles_notify AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION suivi_notify('users', 'user_id', '');
