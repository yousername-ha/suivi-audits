-- Notifications métier (décision 012-10 du 26/10/2026, ADR 0058) : réglage tri-état par groupe, par rôle et par utilisateur,
-- et file de courriels de type « notification » traitée par l'exécutant d'exploitation. Migration additive et rejouable :
-- aucune donnée existante n'est modifiée, aucune notification existante ne change de visibilité.

-- Réglages explicites : une ligne = « activé » ou « désactivé » ; l'absence de ligne = « non défini » (hérite).
-- portee_id : identifiant du groupe (uuid), du rôle (texte) ou du compte (uuid), en texte pour tenir dans une seule table.
CREATE TABLE IF NOT EXISTS notification_reglages (
  portee_kind text NOT NULL CHECK (portee_kind IN ('groupe', 'role', 'utilisateur')),
  portee_id   text NOT NULL CHECK (char_length(portee_id) BETWEEN 1 AND 64),
  type        text NOT NULL CHECK (type ~ '^[a-z][a-z0-9_]{1,40}$'),
  canal       text NOT NULL CHECK (canal IN ('application', 'courriel')),
  valeur      boolean NOT NULL,
  updated_by  text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (portee_kind, portee_id, type, canal)
);

-- Une version par portée (If-Match) : elle change à chaque enregistrement de cette portée.
CREATE TABLE IF NOT EXISTS notification_portees (
  portee_kind text NOT NULL CHECK (portee_kind IN ('groupe', 'role', 'utilisateur')),
  portee_id   text NOT NULL CHECK (char_length(portee_id) BETWEEN 1 AND 64),
  version     integer NOT NULL DEFAULT 1,
  updated_by  text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (portee_kind, portee_id)
);

-- La portée n'a pas de clé étrangère (trois tables possibles) : la suppression d'un groupe, d'un rôle ou d'un compte
-- emporte ses réglages.
CREATE OR REPLACE FUNCTION notification_reglages_nettoyer() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM notification_reglages WHERE portee_kind = TG_ARGV[0] AND portee_id = OLD.id::text;
  DELETE FROM notification_portees WHERE portee_kind = TG_ARGV[0] AND portee_id = OLD.id::text;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS notification_reglages_groupe ON groups;
CREATE TRIGGER notification_reglages_groupe AFTER DELETE ON groups
  FOR EACH ROW EXECUTE FUNCTION notification_reglages_nettoyer('groupe');
DROP TRIGGER IF EXISTS notification_reglages_role ON roles;
CREATE TRIGGER notification_reglages_role AFTER DELETE ON roles
  FOR EACH ROW EXECUTE FUNCTION notification_reglages_nettoyer('role');
DROP TRIGGER IF EXISTS notification_reglages_utilisateur ON users;
CREATE TRIGGER notification_reglages_utilisateur AFTER DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION notification_reglages_nettoyer('utilisateur');

-- Canal « application » : la notification est toujours enregistrée (c'est elle qui empêche un doublon au prochain passage),
-- mais elle n'apparaît dans « Rappels » que si le canal était activé pour la personne au moment de l'émission.
ALTER TABLE grc_notifications ADD COLUMN IF NOT EXISTS canal_application boolean NOT NULL DEFAULT true;

-- Canal « courriel » : nouveau type de demande dans la file de l'ADR 0049. Une demande de notification référence la
-- notification et la personne ; le couple est unique (aucun doublon). L'objet et le corps sont du texte brut sans donnée
-- métier ; l'adresse est relue au moment de l'envoi.
ALTER TABLE courriel_jobs DROP CONSTRAINT IF EXISTS courriel_jobs_kind_check;
ALTER TABLE courriel_jobs ADD CONSTRAINT courriel_jobs_kind_check CHECK (kind IN ('test', 'notification'));
ALTER TABLE courriel_jobs ADD COLUMN IF NOT EXISTS notification_id uuid REFERENCES grc_notifications(id) ON DELETE CASCADE;
ALTER TABLE courriel_jobs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE courriel_jobs ADD COLUMN IF NOT EXISTS subject text CHECK (subject IS NULL OR char_length(subject) <= 200);
ALTER TABLE courriel_jobs ADD COLUMN IF NOT EXISTS body text CHECK (body IS NULL OR char_length(body) <= 4000);
CREATE UNIQUE INDEX IF NOT EXISTS courriel_jobs_notification_unique
  ON courriel_jobs (notification_id, user_id) WHERE notification_id IS NOT NULL;
